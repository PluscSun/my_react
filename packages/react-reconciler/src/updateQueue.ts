import { Dispatch } from 'react/src/currentDispatcher';
import { Action } from 'shared/ReactTypes';
import { Lane, NoLane, isSubsetOfLanes } from './fiberLanes';

export interface Update<State> {
  action: Action<State>;
  lane: Lane;
  next: Update<any> | null;
}

export interface UpdateQueue<State> {
  shared: {
    pending: Update<State> | null;
  };
  // 兼容hooks
  dispatch: Dispatch<State> | null;
}

// update实例化方法
export const createUpdate = <State>(
  action: Action<State>,
  lane: Lane
): Update<State> => {
  return {
    action,
    lane,
    next: null
  };
};

// updateQueue实例化方法
export const createUpdateQueue = <State>() => {
  return {
    shared: {
      pending: null
    },
    dispatch: null
  } as UpdateQueue<State>;
};

// update入队方法
export const enqueueUpdate = <Action>(
  updateQueue: UpdateQueue<Action>,
  update: Update<Action>
) => {
  const pending = updateQueue.shared.pending;
  // 当前updatequeue无update
  if (pending === null) {
    // pending = a -> a
    update.next = update;
  } else {
    // b -> a -> b
    update.next = pending.next;
    pending.next = update;
  }
  // pending = b -> a -> b
  updateQueue.shared.pending = update;
};

/**
 * @description: 消费update
 * @return {
 *  baseState: 被跳过的update前一个update计算后的结果
 *  baseQueue: 被跳过的update及其后面所有的update
 * } baseQueue是从
 * @use: commit阶段消费完一个lane移除之
 */
export const processUpdateQueue = <State>(
  baseState: State,
  pendingUpdate: Update<State> | null,
  renderLane: Lane
): {
  memorizedState: State;
  baseState: State;
  baseQueue: Update<State> | null;
} => {
  const result: ReturnType<typeof processUpdateQueue<State>> = {
    memorizedState: baseState,
    baseState,
    baseQueue: null
  };
  if (pendingUpdate !== null) {
    // 找到环状链表第一个update
    const first = pendingUpdate.next;
    let pending = pendingUpdate.next as Update<any>;
    // 本次被跳过的update前一个update计算后的结果
    let newBaseState = baseState;
    let newBaseQueueFirst: Update<State> | null = null;
    let newBaseQueueLast: Update<State> | null = null;
    // 本次计算出来的结果
    let newState = baseState;
    do {
      const updateLane = pending.lane;
      if (!isSubsetOfLanes(renderLane, updateLane)) {
        // 优先级不够，被跳过
        const clone = createUpdate(pending.action, pending.lane);
        // 判断是不是第一个被跳过的Update
        if (newBaseQueueFirst === null) {
          // first
          newBaseQueueFirst = clone;
          newBaseQueueLast = clone;
          newBaseState = newState;
        } else {
          // 后继
          (newBaseQueueLast as Update<State>).next = clone;
          newBaseQueueLast = clone;
        }
      } else {
        // 优先级足够
        // 判断是否有被跳过的update
        if (newBaseQueueLast !== null) {
          // 本次更新被跳过的update及其后面所有的update都会被保存在baseQueue中参与计算
          // 但是会被标记为Nolane最低优先级
          const clone = createUpdate(pending.action, NoLane);
          (newBaseQueueLast as Update<State>).next = clone;
          newBaseQueueLast = clone;
        }
        const action = pending.action;
        if (action instanceof Function) {
          newState = action(baseState);
        } else {
          newState = action;
        }
      }
      pending = pending.next as Update<any>;
    } while (pending !== first);

    if (newBaseQueueLast === null) {
      // 本次计算没有update被跳过,两者应同步
      newBaseState = newState;
    } else {
      // 合成环状链表
      newBaseQueueLast.next = newBaseQueueFirst;
    }
    result.memorizedState = newState;
    result.baseState = newBaseState;
    result.baseQueue = newBaseQueueLast;
  }
  return result;
};
