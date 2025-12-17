import React, { createContext, useState } from 'react';

// Create a context
/**
 * @typedef {React.Context} SupersetRequestContext
 * @description A context object that provides global data and data request state to its children components.
 * @see https://reactjs.org/docs/context.html
 */
const SupersetRequestContext = createContext();

// Create a provider component
function SupersetRequestProvider({ supersetPort, launched, setSupersetPort, setLaunched, children }) {
    const [url, setUrl] = useState('http://localhost:8080')

    return (
        <SupersetRequestContext.Provider value={{ supersetPort, launched, setSupersetPort, setLaunched, url, setUrl }}>
            {children}
        </SupersetRequestContext.Provider>
    )
}

export { SupersetRequestProvider, SupersetRequestContext };
