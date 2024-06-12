import { FiberRootNode } from './fiber';

export type Lane = number;
export type Lanes = number;

export const SyncLane = 0b0001;
export const NoLane = 0b0000;
export const NoLanes = 0b0000;

export function mergeLanes(laneA: Lane, laneB: Lane): Lanes {
  return laneA | laneB;
}

export function requestUpdateLane() {
  return SyncLane;
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
