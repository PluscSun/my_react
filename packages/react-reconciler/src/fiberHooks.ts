import { Dispatch, Dispatcher } from 'react/src/currentDispatcher';
import { FiberNode } from './fiber';
import internals from 'shared/internals';
import {
  Update,
  UpdateQueue,
  createUpdate,
  createUpdateQueue,
  enqueueUpdate,
  processUpdateQueue
} from './updateQueue';
import { Action } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';
import { Lane, NoLane, requestUpdateLane } from './fiberLanes';
import { Flags, PassiveEffect } from './fiberFlags';
import { HookHasEffect, Passive } from './hookEffectTags';

// 当前render的Fibernode, 方便hooks知道自己的数据保存在哪
let currentlyRenderingFiber: FiberNode | null = null;
// mount时，指向当前正在处理（创建）的hook
let workInProgressHook: Hook | null = null;
// update时，标记当前正在（更新）的hook
let currentHook: Hook | null = null;

let renderLane: Lane = NoLane;

const { currentDispatcher } = internals;

/**
 * @description: hook自身的结构
 */
interface Hook {
  memorizedState: any;
  updateQueue: unknown;
  next: Hook | null;
  baseState: any;
  baseQueue: Update<any> | null;
}

export interface Effect {
  tag: Flags;
  create: EffectCallback | void;
  destroy: EffectCallback | void;
  deps: EffectDeps;
  next: Effect | null;
}

type EffectCallback = () => void;
type EffectDeps = any[] | null;

export interface FCUpdateQueue<State> extends UpdateQueue<State> {
  lastEffect: Effect | null;
}

/**
 * @description: FC的更新方法
 * @param {FiberNode} wip
 */
export function renderWithHooks(wip: FiberNode, lane: Lane) {
  // 赋值操作
  currentlyRenderingFiber = wip;
  // 执行hooks会创建新的hook链表
  // 重置 hooks 链表
  wip.memorizedState = null;
  // 重置 effect 链表
  wip.updateQueue = null;
  renderLane = lane;

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
  renderLane = NoLane;

  return children;
}

const HooksDispatcherOnMount: Dispatcher = {
  useState: mountState,
  useEffect: mountEffect
};

const HooksDispatcherOnUpdate: Dispatcher = {
  useState: updateState,
  useEffect: updateEffect
};

function mountEffect(create: EffectCallback | void, deps: any[] | void) {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;

  (currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;

  hook.memorizedState = pushEffect(
    Passive | HookHasEffect,
    create,
    undefined,
    nextDeps
  );
}

function updateEffect(create: EffectCallback | void, deps: any[] | void) {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  (currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;

  //
  let destroy: EffectCallback | void;

  if (currentHook !== null) {
    const prevEffect = currentHook.memorizedState as Effect;
    destroy = prevEffect.destroy;

    if (nextDeps !== null) {
      // 浅比较依赖,相等，不应执行副作用
      const prevDeps = prevEffect.deps;
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        hook.memorizedState = pushEffect(Passive, create, destroy, nextDeps);
        return;
      }
    }

    // 浅比较依赖不相等
    // 那么fiber要被标记PassiveEffect执行
    (currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;
    // 同时Effect结构要被标记为HookHasEffect
    hook.memorizedState = pushEffect(
      Passive | HookHasEffect,
      create,
      destroy,
      nextDeps
    );
  }
}

function areHookInputsEqual(
  nextDeps: EffectDeps,
  prevDeps: EffectDeps
): boolean {
  if (prevDeps === null || nextDeps === null) {
    return false;
  }
  for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
    if (Object.is(prevDeps[i], nextDeps[i])) {
      continue;
    }
    return false;
  }
  return true;
}

function pushEffect(
  hookFlags: Flags,
  create: EffectCallback | void,
  destroy: EffectCallback | void,
  deps: EffectDeps
): Effect {
  const effect: Effect = {
    tag: hookFlags,
    create,
    destroy,
    deps,
    next: null
  };
  const fiber = currentlyRenderingFiber as FiberNode;
  const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
  if (updateQueue === null) {
    const updateQueue = createFCUpdateQueue();
    fiber.updateQueue = updateQueue;
    effect.next = effect;
    updateQueue.lastEffect = effect;
  } else {
    // 插入effect
    const lastEffect = updateQueue.lastEffect;
    if (lastEffect === null) {
      effect.next = effect;
      updateQueue.lastEffect = effect;
    } else {
      const firstEffect = lastEffect.next;
      lastEffect.next = effect;
      effect.next = firstEffect;
      updateQueue.lastEffect = effect;
    }
  }
  return effect;
}

// 新增的fiber上的fcUpdateQueue用于保存effect链表
// 普通的updateQueue作用是把一系列可能导致重新re-render的情况放入queue中
function createFCUpdateQueue<State>() {
  const updateQueue = createUpdateQueue<State>() as FCUpdateQueue<State>;
  updateQueue.lastEffect = null;
  return updateQueue;
}

function updateState<State>(): [State, Dispatch<State>] {
  // 找到当前useState对应的hooks数据
  const hook = updateWorkInProgressHook();

  // 计算新state的逻辑
  const queue = hook.updateQueue as UpdateQueue<State>;
  const baseState = hook.baseState;

  const pending = queue.shared.pending;

  const current = currentHook as Hook;
  let baseQueue = current.baseQueue;
  // 本来在updateState时会清空queue
  // queue.shared.pending = null;
  // 所以需要把pending放在一个地方，防止优先级打断清空
  // 把update放在current中，因为render阶段才会被打断，所以current始终存在

  if (pending !== null) {
    // pending update basQueue update保存在current中
    if (baseQueue !== null) {
      // 把baseQueue接在pendingUpdate后
      const baseFirst = baseQueue.next;
      const pendingFirst = pending.next;
      baseQueue.next = pendingFirst;
      pending.next = baseFirst;
    }
    baseQueue = pending;
    // 保存在current中
    current.baseQueue = pending;
    queue.shared.pending = null;

    // 如果baseQueue存在
    if (baseQueue !== null) {
      const {
        memorizedState,
        baseQueue: newBaseQueue,
        baseState: newBaseState
      } = processUpdateQueue(baseState, baseQueue, renderLane);
      hook.memorizedState = memorizedState;
      hook.baseState = newBaseState;
      hook.baseQueue = newBaseQueue;
    }
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
    next: null,
    baseQueue: currentHook.baseQueue,
    baseState: currentHook.baseState
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
    updateQueue: null,
    baseQueue: null,
    baseState: null
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
  const lane = requestUpdateLane();
  // 和updateContainer逻辑一致
  const update = createUpdate(action, lane);
  enqueueUpdate(updateQueue, update);
  // 从当前节点开始调度更新
  scheduleUpdateOnFiber(fiber, lane);
}
