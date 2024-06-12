import { Dispatch } from 'react/src/currentDispatcher';
import { Action } from 'shared/ReactTypes';
import { Lane } from './fiberLanes';

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

// 消费update方法
export const processUpdateQueue = <State>(
  baseState: State,
  pendingUpdate: Update<State> | null,
  renderLane: Lane
): { memorizedState: State } => {
  const result: ReturnType<typeof processUpdateQueue<State>> = {
    memorizedState: baseState
  };
  if (pendingUpdate !== null) {
    // 找到环状链表第一个update
    const first = pendingUpdate.next;
    let pending = pendingUpdate.next as Update<any>;
    do {
      const updateLane = pending.lane;
      if (updateLane === renderLane) {
        const action = pending.action;
        if (action instanceof Function) {
          baseState = action(baseState);
        } else {
          baseState = action;
        }
      } else {
        if (__DEV__) {
          console.error('不应该进入');
        }
      }
      pending = pending.next as Update<any>;
    } while (pending !== first);
  }
  result.memorizedState = baseState;
  return result;
};
