import { Key, Props, ReactElementType, Ref } from 'shared/ReactTypes';
import {
  Fragment,
  FunctionComponent,
  HostComponent,
  WorkTag
} from './workTags';
import { Flags, NoFlags } from './fiberFlags';
import { Container } from 'hostConfig';
import { Lane, Lanes, NoLane, NoLanes } from './fiberLanes';
import { Effect } from './fiberHooks';
import { CallbackNode } from 'scheduler';

export class FiberNode {
  // 节点属性
  type: any;
  tag: WorkTag;
  pendingProps: Props;
  key: Key;
  stateNode: any;
  ref: Ref;

  // 构成树状结构
  return: FiberNode | null;
  sibling: FiberNode | null;
  child: FiberNode | null;
  index: number;

  // 作为工作单元
  memorizedProps: Props | null;
  // 指向hooks链表
  memorizedState: any;
  alternate: FiberNode | null;
  flags: Flags;
  subtreeFlags: Flags;
  updateQueue: unknown;
  deletions: FiberNode[] | null;

  constructor(tag: WorkTag, pendingProps: Props, key: Key) {
    // 实例属性
    this.tag = tag;
    this.key = key || null;
    // 实际DOM
    this.stateNode = null;
    // 函数式/类组件
    this.type = null;
    this.ref = null;

    // 指向父fiberNode
    this.return = null;
    this.sibling = null;
    this.child = null;
    // 在同级中处于第几个
    this.index = 0;

    // 工作前props
    this.pendingProps = pendingProps;
    // 工作后props
    this.memorizedProps = null;
    // 更新队列
    this.updateQueue = null;
    // 新的state
    this.memorizedState = null;

    // 另一颗tree
    this.alternate = null;
    // 副作用
    this.flags = NoFlags;
    this.subtreeFlags = NoFlags;
    this.deletions = null;
  }
}

export interface PendingPassiveEffects {
  unmount: Effect[];
  update: Effect[];
}

export class FiberRootNode {
  container: Container;
  current: FiberNode;
  finishedWork: FiberNode | null;
  pendingLanes: Lanes;
  finishedLane: Lane;
  pendingPassiveEffects: PendingPassiveEffects;
  callbackNode: CallbackNode | null;
  callbackPriority: Lane;
  constructor(container: Container, hostRootFiber: FiberNode) {
    this.container = container;
    this.current = hostRootFiber;
    hostRootFiber.stateNode = this;
    this.finishedWork = null;
    this.pendingLanes = NoLanes;
    this.finishedLane = NoLane;
    this.pendingPassiveEffects = {
      unmount: [],
      update: []
    };
    this.callbackNode = null;
    this.callbackPriority = NoLane;
  }
}

export const createWorkInProgress = (
  current: FiberNode,
  pendingProps: Props
): FiberNode => {
  let wip = current.alternate;

  if (wip === null) {
    // 首屏渲染，mount
    wip = new FiberNode(current.tag, pendingProps, current.key);
    wip.stateNode = current.stateNode;

    wip.alternate = current;
    current.alternate = wip;
  } else {
    // update
    wip.pendingProps = pendingProps;
    // 清除副作用
    wip.flags = NoFlags;
    wip.subtreeFlags = NoFlags;
    wip.deletions = null;
  }
  wip.type = current.type;
  wip.updateQueue = current.updateQueue;
  wip.child = current.child;
  wip.memorizedProps = current.memorizedProps;
  wip.memorizedState = current.memorizedState;

  return wip;
};

export function createFiberFromElement(element: ReactElementType): FiberNode {
  const { type, key, props } = element;
  let fiberTag: WorkTag = FunctionComponent;
  if (typeof type === 'string') {
    // <div/> type:'div'
    fiberTag = HostComponent;
  } else if (typeof type !== 'function' && __DEV__) {
    console.warn('未定义type类型', element);
  }
  const fiber = new FiberNode(fiberTag, props, key);
  fiber.type = type;
  return fiber;
}

export function createFiberFromFragment(elements: any[], key: Key): FiberNode {
  const fiber = new FiberNode(Fragment, elements, key);
  return fiber;
}
