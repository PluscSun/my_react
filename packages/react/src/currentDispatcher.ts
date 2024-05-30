/*
 * @Author: sjx
 * @Description: 调用hooks要从react引入, 因此要从react包里暴露出去方法。但是hooks是写在reconciler包里的，所以需要一个内容共享层来传递hooks
 * @FilePath: \my_react\packages\react\src\currentDispatcher.ts
 *********************************************************************************************************/

import { Action } from 'shared/ReactTypes';

/**
 * @description:不同情况（update？mount？处于hooks上下文中？）所触发的useState不一样，Dispatcher不一样
 */
export interface Dispatcher {
  useState: <T>(initialState: (() => T) | T) => [T, Dispatch<T>];
}

export type Dispatch<State> = (action: Action<State>) => void;

/**
 * @description:dispatcher实例
 */
const currentDispatcher: { current: Dispatcher | null } = {
  current: null
};

/**
 * @description:比较方便的获取dispatcher
 */
export const resolveDispatcher = (): Dispatcher => {
  const dispatcher = currentDispatcher.current;

  if (dispatcher === null) {
    throw new Error('hook只能在函数式组件中执行');
  }

  return dispatcher;
};

export default currentDispatcher;
