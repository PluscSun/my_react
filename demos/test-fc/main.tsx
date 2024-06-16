import { useState } from 'react';
import ReactDOM from 'react-dom/client';
import ReactNoopRender from 'react-noop-renderer';

function App() {
  const [num, setNum] = useState<number>(100);
  // const arr =
  //   num % 2 === 0
  //     ? [<li key="1">1</li>, <li key="2">2</li>, <li key="3">3</li>]
  //     : [<li key="3">3</li>, <li key="2">2</li>, <li key="1">1</li>];
  return (
    <ul
      onClickCapture={() => {
        setNum((num) => num + 1);
        setNum((num) => num + 2);
        setNum((num) => num + 3);
      }}
    >
      {num}
      {/* <li>4</li>
      <li>5</li>
      {arr} */}
    </ul>
  );
}

function Child() {
  return <span>big-react</span>;
}

// ReactDOM.createRoot(document.getElementById('root')!).render(<App />);

const root = ReactNoopRender.createRoot();

root.render(<Child />);

window.root = root;
