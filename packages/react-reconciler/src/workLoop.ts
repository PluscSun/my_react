import { beginWork } from './beginWork';
import { completeWork } from './completeWork';
import { FiberNode } from './fiber';

// 工作中的树指针
let workInProgress: FiberNode | null = null;

function prepareFreshStack(fiber: FiberNode) {
  workInProgress = fiber;
}

// 遍历fiberTree的入口
export function renderRoot(root: FiberNode) {
  // 初始化
  prepareFreshStack(root);
  do {
    try {
      workLoop();
      break;
    } catch (e) {
      console.log('workloop error');
      workInProgress = null;
    }
    // eslint-disable-next-line no-constant-condition
  } while (true);
}

// 工作循环
function workLoop() {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

function performUnitOfWork(fiber: FiberNode) {
  const next = beginWork(fiber);
  fiber.memorizedProps = fiber.pendingProps;

  if (next === null) {
    completeUnitOfWork(fiber);
  } else {
    workInProgress = next;
  }
}

function completeUnitOfWork(fiber: FiberNode) {
  let node: FiberNode | null = fiber;
  do {
    completeWork(node);
    const sibling = node.sibling;

    if (sibling !== null) {
      workInProgress = sibling;
      return;
    }
    node = node.return;
  } while (node !== null);
}
