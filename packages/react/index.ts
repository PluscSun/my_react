//React

import currentDispatcher, {
  Dispatcher,
  resolveDispatcher
} from './src/currentDispatcher';
import { jsx, jsxDEV, isValidElement as isValidElementFn } from './src/jsx';

export const useState: Dispatcher['useState'] = (initialState) => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useState(initialState);
};

export const useEffect: Dispatcher['useEffect'] = (create, deps) => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useEffect(create, deps);
};

// 内部数据共享层
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED_LOT = {
  currentDispatcher
};

export const version = '0.0.0';
// TODO 根据环境区分使用jsx还是jsxDEV
export const createElement = jsx;

export const _createElement = jsxDEV;

export const isValidElement = isValidElementFn;
