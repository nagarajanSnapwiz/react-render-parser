import React, { useState, useRef } from 'react'
import logo from './logo.svg'
import { SimpleParser } from './renderer/renderer'
import './App.css'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      //top level parent
      choice: any
      all: any

      //normal parents
      trim: any
      and: any
      or: any
      next: any
      skip: any
      wrap: any
      sepBy: any

      //child items
      match: any
      string: any
      noop: any
    }
  }
}

function OptWhiteSpace({children}:{children:any}) {
  return (
    <trim>
      {children}
    <or>
      <match pattern="\s+" />
      <noop value="" />
    </or>
    </trim>
  )
}

function App() {
  const [showMatch, setShowMatch] = useState(true)
  const parserRef = useRef();
  console.log('parserRef',parserRef);
  return (
    <div className="App">
      <header className="App-header">
        showMatch:{`${showMatch}`}
        <img src={logo} className="App-logo" alt="logo" />
        <p onClick={() => setShowMatch((x) => !x)}>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
      <SimpleParser ref={parserRef}>
        <choice>
          <all>
            <string text="test" />
            <next transform={(x)=>{
              console.log('next x',x);
              return x;
            }}>
              <match pattern="\s+" desc="whitespace" />
              <match pattern="[0-9]+" desc="number" transform={(x)=> Number(x)} />
            </next>
          </all>
          <all
            transform={(x: any) => {
              console.log('recieved y', x)
              return x
            }}
          >
             <OptWhiteSpace>
            <match pattern="[0-9]+" transform={(x: any) => {
              console.log('x number', {x});
              return Number(x);
            }} />
            </OptWhiteSpace>
            <sepBy min={1}>
              <OptWhiteSpace>
                <match pattern="[a-z]+" transform={(x: any) => `x:${x}`} />
              </OptWhiteSpace>
              <string text="," />
            </sepBy>
          </all>
        </choice>
      </SimpleParser>
    </div>
  )
}

export default App
