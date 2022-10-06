import * as bnb from "bread-n-butter";
import { isEmpty } from "lodash";

function idGeneratorFactory() {
  let count = 0;

  return () => {
    count += 1;
    return count;
  };
}

const idGenerator = idGeneratorFactory();

class ParserNode {
  parserMethod: bnb.Parser<any>;
  transform?: (x: any) => any;
  desc?: string;
  repeatMax: number = Infinity;
  repeatMin: number = 0;

  constructor(parserMethod: bnb.Parser<any>) {
    this.parserMethod = parserMethod;
  }

  update({
    parserMethod,
    transform,
    repeatMax = Infinity,
    repeatMin = 0,
    desc=null,
  }: {
    parserMethod?: bnb.Parser<any>;
    repeatMax?: number;
    repeatMin?: number;
    transform?: (x: any) => any;
    desc?: null;
  }) {
    if (parserMethod) {
      this.parserMethod = parserMethod;
    }
    if (transform) {
      this.transform = transform;
      //this.parserMethod = this.parserMethod.map(transform);
    }

    if(desc){
      this.desc = desc;
    }

    if (repeatMin || isFinite(repeatMax)) {
      this.repeatMax = repeatMax;
      this.repeatMin = repeatMin;
      //this.parserMethod = this.parserMethod.repeat(repeatMin, repeatMax);
    }
  }
}

interface GenericParserNode {
  update: (props: any) => void;
  appendChild?: (child: GenericParserNode) => void;
  removeChild?: (child: GenericParserNode) => void;
  reOrderBeforeChild?: (
    child: GenericParserNode,
    beforeChild: GenericParserNode
  ) => void;
}

export class ParserBase {
  parserNode?: ParserNode;
  id: Number;

  constructor() {
    this.id = idGenerator();
  }

  //for type signature
  update(props: any) {}

  getParser() {
    let parser = null;
    if (!this.parserNode) {
      return null;
    }
    parser = this.parserNode.parserMethod;
    const { repeatMax, repeatMin, transform, desc } = this.parserNode;
    if(desc){
      parser = parser.desc([desc]);
    }
    if (repeatMin || isFinite(repeatMax)) {
      parser = parser.repeat(repeatMin, repeatMax);
    }
    
    if (transform) {
      parser = parser.map(transform);
    }
    
    console.log("parser being returned", parser);
    return parser;
  }
}

export class TextParser extends ParserBase implements GenericParserNode {
  parserNode: ParserNode;

  constructor({ text, ...props }: { text: string; [key: string]: any }) {
    super();
    this.parserNode = new ParserNode(bnb.text(text));
    this.parserNode.update(props as any);
  }

  update({ text, ...props }: { text?: string; [key: string]: any }) {
    this.parserNode.update(
      text ? { parserMethod: bnb.text(text), ...props } : props
    );
  }
}

export class NoopParser extends ParserBase implements GenericParserNode {
  parserNode: ParserNode;

  constructor({ value, ...props }: { value: string; [key: string]: any }) {
    super();
    this.parserNode = new ParserNode(bnb.ok(value));
    this.parserNode.update(props as any);
  }

  update({ value, ...props }: { value?: string; [key: string]: any }) {
    this.parserNode.update(
      value ? { parserMethod: bnb.ok(value), ...props } : props
    );
  }
}

export class MatchParser extends ParserBase implements GenericParserNode {
  parserNode: ParserNode;

  constructor({ pattern, ...props }: { pattern: string; [key: string]: any }) {
    super();
    console.log(`regexp we are creating ------>>>> ${pattern} `,{pattern}, new RegExp(pattern))
    this.parserNode = new ParserNode(bnb.match(new RegExp(pattern)));
    this.parserNode.update(props as any);
  }

  update({ pattern, ...props }: { pattern?: string; [key: string]: any }) {
    this.parserNode.update(
      pattern
        ? { parserMethod: bnb.match(new RegExp(pattern)), ...props }
        : props
    );
  }
}

const parserLevelCombinators = [
  "and",
  "or",
  "next",
  "skip",
  "wrap",
  "trim",
  "sepBy",
] as const;
export const parserLevelCombinatorsSet = new Set(parserLevelCombinators);
export type ParentMethodNames = typeof parserLevelCombinators[number];

export class ParentParser extends ParserBase {
  children: ParserBase[];
  method: ParentMethodNames;
  args: number[] = [];

  constructor(method: ParentMethodNames, ...args: number[]) {
    super();
    this.method = method;
    if (args.length) {
      this.args = args;
    }
    this.children = [];
    this.parserNode = undefined;
  }

  mapChildrenToParser() {
    if (this.children.length === 1) {
      this.parserNode = this.children[0].parserNode;
    } else if (this.children.length === 2 || this.children.length === 3) {
      const existingParser = this.getParser();
      if (!existingParser) {
        throw new Error("No existing parser");
      }
      let newParser = null;
      if (this.children.length === 2) {
        const [_child1, child2] = this.children;
        //@ts-ignore
        newParser = existingParser[this.method](
          child2.getParser(),
          ...this.args
        );
      } else {
        const [child1, child2, child3] = this.children;
        //@ts-ignore
        newParser = child1
          .getParser()
          [this.method](child2.getParser(), child3.getParser());
      }

      this.parserNode = new ParserNode(newParser);
    }
  }

  appendChild(childNode: ParserBase) {
    if ([0, 1, 2].includes(this.children.length)) {
      this.children = [...this.children, childNode];
      this.mapChildrenToParser();
    } else {
      throw new Error("too many children found during appendChild");
    }
  }

  removeChild(childNode: ParserBase) {
    if ([2, 3].includes(this.children.length)) {
      this.children = this.children.filter((x) => x.id === childNode.id);
      this.mapChildrenToParser();
    } else {
      throw new Error("too few children found during removeChild");
    }
  }

  insertBefore(child: ParserBase, beforeChild: ParserBase) {
    const beforeChildIndex = this.children.findIndex(
      (x) => x.id === beforeChild.id
    );
    this.children.splice(beforeChildIndex, 0, child);
    this.mapChildrenToParser();
  }
}

const topLevelParserCombinators = ["all", "choice"] as const;
export const topLevelParserCombinatorsSet = new Set(topLevelParserCombinators);
export type TopLevelParentMethodNames =
  typeof topLevelParserCombinators[number];

export class TopLevelParentParser extends ParserBase {
  children: ParserBase[];
  method: TopLevelParentMethodNames;
  tempProps?: any;

  constructor(method: TopLevelParentMethodNames,props:any) {
    super();
    this.method = method;

    this.children = [];
    this.parserNode = undefined;

  }

  update(props: any) {
    if(this.parserNode){
      this.tempProps = null;
      this.parserNode.update(props);
    } else {
      this.tempProps = props;
    }
    
  }

  mapChildrenToParser() {
    const newParser = (bnb[this.method] as any)(
      ...this.children.map((child) => child.getParser())
    ) as bnb.Parser<any>;
    this.parserNode = new ParserNode(newParser);
    if(this.tempProps){
      this.update(this.tempProps);
      console.log('tempProps',this.tempProps);
    } else {
      console.log('noTempProps', this);
    }
  }

  appendChild(childNode: ParserBase) {
    if ([0, 1, 2].includes(this.children.length)) {
      this.children = [...this.children, childNode];
      this.mapChildrenToParser();
    } else {
      throw new Error("too many children found during appendChild");
    }
  }

  removeChild(childNode: ParserBase) {
    if ([2, 3].includes(this.children.length)) {
      this.children = this.children.filter((x) => x.id === childNode.id);
      this.mapChildrenToParser();
    } else {
      throw new Error("too few children found during removeChild");
    }
  }

  insertBefore(child: ParserBase, beforeChild: ParserBase) {
    const beforeChildIndex = this.children.findIndex(
      (x) => x.id === beforeChild.id
    );
    this.children.splice(beforeChildIndex, 0, child);
    this.mapChildrenToParser();
  }
}
