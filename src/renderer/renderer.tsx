import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import ReactReconciler from 'react-reconciler'
import { diff } from 'deep-object-diff'
import { omit, isEmpty } from 'lodash'
import * as bnb from 'bread-n-butter';
import {
  parserLevelCombinatorsSet,
  topLevelParserCombinatorsSet,
  ParentMethodNames,
  TopLevelParentMethodNames,
  ParentParser,
  TopLevelParentParser,
  TextParser,
  MatchParser,
  ParserBase,
  NoopParser,
} from './host'

type ParentParserType = ParentParser | TopLevelParentParser

function validateParentType(type: string) {
  if (parserLevelCombinatorsSet.has(type as any)) {
    return { isTopLevel: false }
  } else if (topLevelParserCombinatorsSet.has(type as any)) {
    return { isTopLevel: true }
  }
  return null
}

function createInstance(type: string, props: any = {}) {
  let parser: ParserBase
  if(type === "noop"){
    parser = new NoopParser(props);
  } else if(type === "string"){
    parser = new TextParser(props);
  } else if(type === "match"){
    parser = new MatchParser(props);
  } else {
    const parentType = validateParentType(type);
    if(!parentType){
      throw new Error(`Unknown node type ${type}`);
    }
    
    if(parentType.isTopLevel){
      parser = new TopLevelParentParser(type as TopLevelParentMethodNames, props);
    } else {
      let args:number[] = [];
      if(type === "sepBy"){
        const {min=0,max=Infinity} = props;
        args = [min, max];
      }
      parser = new ParentParser(type as ParentMethodNames,...args)
    }
  }
  return parser;
}

const NO_CONTEXT = {}

const reconciler = ReactReconciler({
  //@ts-ignore
  now: Date.now,
  scheduleTimeout: setTimeout,
  cancelTimeout: clearTimeout,
  noTimeout: -1,
  warnsIfNotActing: false,
  getRootHostContext: (rootContainer: any) => {
    return NO_CONTEXT
  },
  getChildHostContext: (
    parentHostContext: any,
    type: string,
    rootContainer: any,
  ) => {
    return NO_CONTEXT
  },
  getPublicInstance: (instance: any) => instance,
  prepareForCommit: (containerInfo: any) => {
    return null
  },
  resetAfterCommit: (containerInfo: any) => {},
  detachDeletedInstance: () => {},
  createInstance: (type: string, props, rootContainer) => {
    console.log('creating instance ', { type, props })
    return createInstance(type,props);
  },
  appendInitialChild: (parent: ParentParserType, child: ParserBase) => {
    //parent.appendChild(child);
    parent.appendChild(child);
    console.log(`appending initial child `, child, ` to parent `, parent)
  },
  finalizeInitialChildren: (instance, type, props, rootContainer) => {
    return false
  },
  shouldSetTextContent: (type, props) => false,
  supportsMutation: true,
  clearContainer: (container) => {},
  appendChildToContainer: (container:any, child: ParserBase) => {
    console.log('appending child', child, 'to container', container)
    container._parserInstance = child;
  },
  removeChild: (parent: ParentParserType, child: ParserBase) => {
    parent.removeChild(child);
    console.log('removing child', child, 'parent', parent)
  },
  removeChildFromContainer: (container:any, child) => {
    delete container._parserInstance;
    console.log('removing child', child, 'from container', container)
  },
  prepareUpdate: (_instance, _type, oldProps: Object, newProps: Object) => {
    const _oldProps = omit(oldProps, 'children')
    const _newProps = omit(newProps, 'children')
    const diffObject = diff(_oldProps, _newProps)
    return isEmpty(diffObject) ? false : diffObject
  },
  commitUpdate: (instance: ParserBase, updatePayload, type, prevProps, nextProps) => {
    console.log('commit update', {
      instance,
      updatePayload,
      type,
      prevProps,
      nextProps,
    })
    if(instance.update){
      instance.update(updatePayload);
    } else {
      console.warn('no update for',instance);
    }
    
  },
  insertBefore: (parent: ParentParserType, child: ParserBase, beforeChild: ParserBase) => {
    console.log('insertBefore', { parent, child, beforeChild })
    parent.insertBefore(child,beforeChild);
  },
  insertInContainerBefore: (container, child, beforeChild) => {
    console.log('insertInContainerBefore', { container, child, beforeChild })
    throw new Error('InsertInContainer not supported')
  },
  appendChild: (parentInstance: ParentParserType, child: ParserBase) => {
    parentInstance.appendChild(child);
    console.log('appendChild', { parentInstance, child })
  },
})

export function render(reactElement: any, hostElement: any) {
  console.log('hostElement root', hostElement)
  if (!hostElement._root) {
    console.log('creating root>>>>>>>>>>>>>>>>>>>>>>>>>>>>')
    hostElement._root = reconciler.createContainer(
      hostElement,
      undefined as any,
      null,
      null as any,
      null,
      undefined as any,
      unmount,
      null,
    )
  }

  reconciler.updateContainer(reactElement, hostElement._root)
  return reconciler.getPublicRootInstance(hostElement._root)
}

export function unmount(hostElement: any) {
  if (hostElement._root) {
    reconciler.updateContainer(null, hostElement._root, undefined, () => {
      delete hostElement._root
    })
  }
}
const h1Style = { background: 'blue', color: 'green' }

const SimpleParser_ = ({ children }: { children: any }, ref:any) => {
  const rootRef = useRef<any>({})

  useImperativeHandle(ref,()=>({
    parse: (code: string) => rootRef.current._parserInstance.getParser().parse(code) 
  }))

  useEffect(() => {
    render(children, rootRef.current)

    return () => {
      console.log('unmount >>>>>>>>')
      unmount(rootRef.current)
    }
  }, [])

  useEffect(() => {
    console.warn('rootRef current', rootRef.current)
    render(children, rootRef.current)
  }, [children])
  
  return <span ref={ref}></span>;
}

export const SimpleParser = forwardRef(SimpleParser_);
