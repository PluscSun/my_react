import { Dispatch, Dispatcher } from 'react/src/currentDispatcher';
import { FiberNode } from './fiber';
import internals from 'shared/internals';
import {
  UpdateQueue,
  createUpdate,
  createUpdateQueue,
  enqueueUpdate,
  processUpdateQueue
} from './updateQueue';
import { Action } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';

// 当前render的Fibernode, 方便hooks知道自己的数据保存在哪
let currentlyRenderingFiber: FiberNode | null = null;
// 指向当前正在处理的hook
let workInProgressHook: Hook | null = null;

let currentHook: Hook | null = null;

console.log(currentlyRenderingFiber, workInProgressHook);

const { currentDispatcher } = internals;

/**
 * @description: hook自身的结构
 */
interface Hook {
  memorizedState: any;
  updateQueue: unknown;
  next: Hook | null;
}

/**
 * @description: FC的更新方法
 * @param {FiberNode} wip
 */
export function renderWithHooks(wip: FiberNode) {
  // 赋值操作
  currentlyRenderingFiber = wip;
  // 执行hooks会创建新的hook链表
  // 重置 hooks 链表
  wip.memorizedState = null;

  const current = wip.alternate;

  if (current !== null) {
    // update
    currentDispatcher.current = HooksDispatcherOnUpdate;
  } else {
    // mount
    currentDispatcher.current = HooksDispatcherOnMount;
  }

  const Component = wip.type;
  const props = wip.pendingProps;
  const children = Component(props);

  // 重置操作：全局变量
  currentlyRenderingFiber = null;
  workInProgressHook = null;
  currentHook = null;

  return children;
}

const HooksDispatcherOnMount: Dispatcher = {
  useState: mountState
};

const HooksDispatcherOnUpdate: Dispatcher = {
  useState: updateState
};

function updateState<State>(): [State, Dispatch<State>] {
  // 找到当前useState对应的hooks数据
  const hook = updateWorkInProgressHook();

  // 计算新state的逻辑
  const queue = hook.updateQueue as UpdateQueue<State>;
  const pending = queue.shared.pending;

  if (pending !== null) {
    const { memorizedState } = processUpdateQueue(hook.memorizedState, pending);
    hook.memorizedState = memorizedState;
  }
  return [hook.memorizedState, queue.dispatch as Dispatch<State>];
}

/**
 * @description: 更新wip时，操作hooks链表
 * @return {*}
 * @use: 用于updateState中，取到对应hook
 */
function updateWorkInProgressHook(): Hook {
  //TODO render阶段触发的更新
  let nextCurrentHook: Hook | null;
  if (currentHook === null) {
    // 这是这个FC update时第一个hook
    const current = currentlyRenderingFiber?.alternate;
    if (current !== null) {
      nextCurrentHook = current?.memorizedState;
    } else {
      // mount
      nextCurrentHook = null;
    }
  } else {
    // 这个FC update时，后续的hook
    nextCurrentHook = currentHook.next;
  }

  if (nextCurrentHook === null) {
    throw new Error(`组件本次执行时的hook比上次执行时的多`);
  }

  currentHook = nextCurrentHook as Hook;
  const newHook: Hook = {
    memorizedState: currentHook.memorizedState,
    updateQueue: currentHook.updateQueue,
    next: null
  };
  if (workInProgressHook === null) {
    // mount时第一个hook,要创建hook并赋值给fibernode的memostate
    if (currentlyRenderingFiber === null) {
      // 不在组件内调用hook
      throw new Error('请在函数组件内调用hook');
    } else {
      workInProgressHook = newHook;
      currentlyRenderingFiber.memorizedState = workInProgressHook;
    }
  } else {
    // mount时，后续的hook
    workInProgressHook.next = newHook;
    workInProgressHook = newHook;
  }
  return workInProgressHook;
}

function mountState<State>(
  initialState: (() => State) | State
): [State, Dispatch<State>] {
  // 找到当前useState对应的hooks数据
  const hook = mountWorkInProgressHook();

  let memorizedState;

  if (initialState instanceof Function) {
    memorizedState = initialState();
  } else {
    memorizedState = initialState;
  }

  const queue = createUpdateQueue<State>();

  hook.updateQueue = queue;
  hook.memorizedState = memorizedState;

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue);

  queue.dispatch = dispatch;

  return [memorizedState, dispatch];
}

function mountWorkInProgressHook(): Hook {
  const hook: Hook = {
    memorizedState: null,
    next: null,
    updateQueue: null
  };
  if (workInProgressHook === null) {
    // mount时第一个hook,要创建hook并赋值给fibernode的memostate
    if (currentlyRenderingFiber === null) {
      // 不在组件内调用hook
      throw new Error('请在函数组件内调用hook');
    } else {
      workInProgressHook = hook;
      currentlyRenderingFiber.memorizedState = workInProgressHook;
    }
  } else {
    // mount时，后续的hook
    workInProgressHook.next = hook;
    workInProgressHook = hook;
  }

  return workInProgressHook;
}

function dispatchSetState<State>(
  fiber: FiberNode,
  updateQueue: UpdateQueue<State>,
  action: Action<State>
) {
  // 和updateContainer逻辑一致
  const update = createUpdate(action);
  enqueueUpdate(updateQueue, update);
  // 从当前节点开始调度更新
  scheduleUpdateOnFiber(fiber);
}
