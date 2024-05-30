import { FiberNode } from './fiber';
import internals from 'shared/internals';

// 当前render的Fibernode, 方便hooks知道自己的数据保存在哪
let currentlyRenderingFiber: FiberNode | null = null;
// 指向当前正在处理的hook
const workInProgressHook: Hook | null = null;

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
  wip.memorizedState = null;

  const current = wip.alternate;

  if (current !== null) {
    // update
  } else {
    // mount
    currentDispatcher.current = null;
  }

  const Component = wip.type;
  const props = wip.pendingProps;
  const children = Component(props);

  // 重置操作
  currentlyRenderingFiber = null;

  return children;
}
