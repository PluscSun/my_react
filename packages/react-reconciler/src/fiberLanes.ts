import {
  unstable_IdlePriority,
  unstable_ImmediatePriority,
  unstable_NormalPriority,
  unstable_UserBlockingPriority,
  unstable_getCurrentPriorityLevel
} from 'scheduler';
import { FiberRootNode } from './fiber';

export type Lane = number;
export type Lanes = number;

export const SyncLane = 0b0001;
export const InputContinuousLane = 0b0010;
export const DefaultLane = 0b0100;
export const IdleLane = 0b1000;
export const NoLane = 0b0000;
export const NoLanes = 0b0000;

export function mergeLanes(laneA: Lane, laneB: Lane): Lanes {
  return laneA | laneB;
}

export function requestUpdateLane() {
  // 从当前上下文环境获取Scheduler优先级
  const currentSchedulePriority = unstable_getCurrentPriorityLevel();
  const lane = schedulerPriorityToLane(currentSchedulePriority);
  return lane;
}

export function getHighestPriorityLane(lanes: Lanes): Lane {
  // 返回最小的lane，即最右边的1
  return lanes & -lanes;
}

/**
 * @description: 从当前root的pendingLanes中移除对应的lane
 * @param {FiberRootNode} root
 * @param {Lane} lane
 * @return {*}
 * @use: commit阶段消费完一个lane移除之
 */
export function markRootFinished(root: FiberRootNode, lane: Lane) {
  root.pendingLanes &= ~lane;
}

// 使用调度器调度时，使用的是调度器优先级
// 在react中，使用的是Lane优先级
// 解耦两个不同的优先级体系，但也需要转换方式
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function lanesToSchedulerPriority(lanes: Lanes) {
  const lane = getHighestPriorityLane(lanes);
  if (lane === SyncLane) {
    return unstable_ImmediatePriority;
  }
  if (lane === InputContinuousLane) {
    return unstable_UserBlockingPriority;
  }
  if (lane === DefaultLane) {
    return unstable_NormalPriority;
  }
  return unstable_IdlePriority;
}

function schedulerPriorityToLane(schedulerPriority: number) {
  if (schedulerPriority === unstable_ImmediatePriority) {
    return SyncLane;
  }
  if (schedulerPriority === unstable_UserBlockingPriority) {
    return InputContinuousLane;
  }
  if (schedulerPriority === unstable_NormalPriority) {
    return DefaultLane;
  }
  return NoLane;
}
