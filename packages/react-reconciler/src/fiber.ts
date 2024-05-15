import { Key, Props, Ref } from 'shared/ReactTypes';
import { WorkTags } from './workTags';
import { Flags, NoFlags } from './fiberFlags';

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
  alternate: FiberNode | null;
  flags: Flags;

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

    // 另一颗tree
    this.alternate = null;
    // 副作用
    this.flags = NoFlags;
  }
}
