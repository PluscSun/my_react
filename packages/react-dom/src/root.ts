// ReactDOM.createRoot(root).render(<App/>)

import { ReactElementType } from 'shared/ReactTypes';
import { Container } from './hostConfig';
import {
  createContainer,
  updateContainer
} from 'react-reconciler/src/fiberReconciler';
import { initEvent } from './synTheticEvent';

export function createRoot(container: Container) {
  const root = createContainer(container);
  return {
    render(element: ReactElementType) {
      initEvent(container, 'click');
      return updateContainer(element, root);
    }
  };
}
