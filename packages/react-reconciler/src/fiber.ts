import { Key, Props, Ref } from 'shared/ReactTypes';
import { WorkTags } from './workTags';
import { Flags, NoFlags } from './fiberFlags';
import { Container } from 'hostConfig';

export class FiberNode {
  // 节点属性
  type: any;
  tag: WorkTags;
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
  memorizedState: any;
  alternate: FiberNode | null;
  flags: Flags;
  updateQueue: unknown;

  constructor(tag: WorkTags, pendingProps: Props, key: Key) {
    // 实例属性
    this.tag = tag;
    this.key = key;
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
  }
}

export class FiberRootNode {
  container: Container;
  current: FiberNode;
  finishedWork: FiberNode | null;
  constructor(container: Container, hostRootFiber: FiberNode) {
    this.container = container;
    this.current = hostRootFiber;
    hostRootFiber.stateNode = this;
    this.finishedWork = null;
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
  }
  wip.type = current.type;
  wip.updateQueue = current.updateQueue;
  wip.child = current.child;
  wip.memorizedProps = current.memorizedProps;
  wip.memorizedState = current.memorizedState;

  return wip;
};
