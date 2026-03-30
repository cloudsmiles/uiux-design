/**
 * React plugin — helpers, stubs, and CDN loading for React component preview
 */

/** React hooks destructuring (injected before user code) */
export const REACT_HOOKS = `
const { useState, useEffect, useRef, useMemo, useCallback, Fragment,
        createContext, useContext, useReducer, forwardRef, memo, lazy,
        Suspense, StrictMode, useId, useTransition, useDeferredValue,
        useImperativeHandle, useLayoutEffect, useSyncExternalStore,
        useInsertionEffect, useDebugValue } = React;
const { createRoot, createPortal, flushSync } = ReactDOM;
const cn = (...args) => args.filter(Boolean).join(' ');
`;

/** SVG stub for undefined icon/component references */
export const COMPONENT_STUB = `
var _stub = function(props) {
  return React.createElement('svg', {
    width: (props && props.size) || 24,
    height: (props && props.size) || 24,
    viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
    className: (props && props.className) || '', style: props && props.style
  });
};
`;

/** Default stubs for common React ecosystem libraries */
export const DEFAULT_STUBS = `
const { Link, NavLink, Route, Routes, useParams, useNavigate, useLocation, useMatch } = {
  Link: _stub, NavLink: _stub, Route: _stub, Routes: _stub,
  useParams: () => ({}), useNavigate: () => (() => {}),
  useLocation: () => ({ pathname: '/' }), useMatch: () => null
};
const { Provider, useSelector, useDispatch, connect } = {
  Provider: ({ children }) => children, useSelector: () => ({}),
  useDispatch: () => (() => {}), connect: () => (c) => c
};
const motion = new Proxy({}, { get: (_, tag) => tag });
const AnimatePresence = ({ children }) => children;
const _ = { debounce: fn => fn, throttle: fn => fn, cloneDeep: obj => JSON.parse(JSON.stringify(obj)), get: (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj) };
const axios = { get: () => Promise.resolve({ data: {} }), post: () => Promise.resolve({ data: {} }), put: () => Promise.resolve({ data: {} }), delete: () => Promise.resolve({ data: {} }) };
const dayjs = (d) => ({ format: () => String(d), valueOf: () => Date.now() });
`;

/** React CDN URLs by version (npmmirror primary, bootcdn backup, unpkg fallback) */
export const REACT_CDN_VERSIONS: Record<string, string[][]> = {
  '18': [
    [
      'https://registry.npmmirror.com/react/18.2.0/files/umd/react.production.min.js',
      'https://cdn.bootcdn.net/ajax/libs/react/18.2.0/umd/react.production.min.js',
      'https://unpkg.com/react@18.2.0/umd/react.production.min.js',
    ],
    [
      'https://registry.npmmirror.com/react-dom/18.2.0/files/umd/react-dom.production.min.js',
      'https://cdn.bootcdn.net/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js',
      'https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js',
    ],
  ],
  '17': [
    [
      'https://registry.npmmirror.com/react/17.0.2/files/umd/react.production.min.js',
      'https://cdn.bootcdn.net/ajax/libs/react/17.0.2/umd/react.production.min.js',
    ],
    [
      'https://registry.npmmirror.com/react-dom/17.0.2/files/umd/react-dom.production.min.js',
      'https://cdn.bootcdn.net/ajax/libs/react-dom/17.0.2/umd/react-dom.production.min.js',
    ],
  ],
  '16': [
    [
      'https://registry.npmmirror.com/react/16.14.0/files/umd/react.production.min.js',
      'https://cdn.bootcdn.net/ajax/libs/react/16.14.0/umd/react.production.min.js',
    ],
    [
      'https://registry.npmmirror.com/react-dom/16.14.0/files/umd/react-dom.production.min.js',
      'https://cdn.bootcdn.net/ajax/libs/react-dom/16.14.0/umd/react-dom.production.min.js',
    ],
  ],
};

/** Babel CDN URLs */
export const BABEL_CDN = [
  'https://registry.npmmirror.com/@babel/standalone/7.23.9/files/babel.min.js',
  'https://cdn.bootcdn.net/ajax/libs/babel-standalone/7.23.9/babel.min.js',
  'https://unpkg.com/@babel/standalone@7.23.9/babel.min.js',
];
