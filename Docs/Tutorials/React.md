# React for Complete Beginners

This tutorial is for people who have never used React. You will learn what React is, set up a small app on your computer, and practice the everyday pieces: components, props, state, and clicks.

You do not need to memorize everything. Follow the steps once. The same few ideas show up again and again.

You should already be able to:

- Open a terminal (Terminal on macOS, Git Bash or PowerShell on Windows)
- Write a little HTML (tags like `<p>` and `<button>`)
- Write a little JavaScript (variables, functions, `if`, arrays)

If JavaScript still feels new, that is okay. You will see it in context here.

---

## What is React?

**React** is a JavaScript library for building user interfaces. Instead of rewriting a whole HTML page when something changes, you describe the screen as small reusable pieces called **components**. React updates only what needs to change.

A simple picture:

```
Your components (JSX)  --->  React  --->  what the user sees in the browser
```

Think of a webpage as Lego. Each brick is a component (a button, a card, a header). You snap bricks together to make a page. When one brick’s data changes, React rebuilds that brick, not the whole set.

React is not a programming language. It is JavaScript plus a few extra rules (especially **JSX**, which looks like HTML inside JavaScript).

---

## Words you will see a lot

| Word | Meaning in plain English |
| --- | --- |
| **Component** | A reusable piece of UI, usually a function that returns JSX |
| **JSX** | HTML-like syntax inside JavaScript files |
| **Props** | Inputs you pass into a component (like function arguments) |
| **State** | Data a component remembers; when it changes, React re-renders |
| **Render** | React drawing (or updating) the UI from your components |
| **Hook** | A special function whose name starts with `use`, like `useState` |
| **`useState`** | The hook that lets a component keep and update state |
| **Event** | Something the user does, like a click or a keypress |
| **Vite** | A tool that creates and runs your React project while you develop |
| **Node.js** | A program that lets your computer run JavaScript outside the browser |

---

## 1. Install Node.js

React projects need **Node.js** so you can run the development server and install packages.

1. Go to [https://nodejs.org](https://nodejs.org) and download the **LTS** version.
2. Install it with the defaults.
3. Close and reopen your terminal.
4. Check that it worked:

```bash
node -v
npm -v
```

You should see version numbers, for example `v22.x.x` and `10.x.x`.

`npm` is the package manager that comes with Node. You use it to install libraries (including React).

---

## 2. Create your first React app

This tutorial uses **Vite**. It is the usual way to start a React project in 2026.

In a folder where you keep projects:

```bash
npm create vite@latest my-first-react -- --template react
cd my-first-react
npm install
npm run dev
```

What those commands do:

1. `npm create vite@latest ...` — scaffolds a new React project named `my-first-react`
2. `cd my-first-react` — go into that folder
3. `npm install` — download React and other dependencies into `node_modules/`
4. `npm run dev` — start a local website

The terminal will print a URL, usually `http://localhost:5173`. Open it in your browser. You should see the default Vite + React page.

Leave that terminal running while you work. In your editor, change a file, save, and the browser should update on its own.

To stop the server later, click that terminal and press `Ctrl + C`.

---

## 3. What is in the project folder?

You do not need every file on day one. These are the ones that matter:

| Path | Role |
| --- | --- |
| `index.html` | The single HTML page. React “mounts” your app into a `<div>` here |
| `src/main.jsx` | The starting point. It tells React where to draw the app |
| `src/App.jsx` | Your main component. Most of your early work happens here |
| `src/App.css` | Styles for `App` |
| `package.json` | Project name, scripts (`dev`, `build`), and dependencies |

Open `src/main.jsx`. You will see something like: take the `App` component and render it into an element with `id="root"`.

Open `src/App.jsx`. That is the component currently on screen. You will replace its contents as you learn.

**Never commit `node_modules/`.** It is huge and can be rebuilt with `npm install`. A `.gitignore` file from Vite already skips it.

---

## 4. JSX: HTML inside JavaScript

A React component is a **function** that **returns JSX**.

Replace everything in `src/App.jsx` with:

```jsx
function App() {
  return (
    <div>
      <h1>Hello, React</h1>
      <p>This is my first component.</p>
    </div>
  )
}

export default App
```

Save. The browser should show the heading and paragraph.

JSX looks like HTML, with a few differences:

- You return **one parent**. Wrap siblings in a `<div>` or in `<>...</>` (a fragment).
- Use `className` instead of `class` (because `class` is already a word in JavaScript).
- Most tags must be closed: `<img />`, `<br />`, `<input />`.
- JavaScript goes in curly braces: `{2 + 2}` or `{userName}`.

Example with a variable:

```jsx
function App() {
  const name = "Ada"

  return (
    <h1>Hello, {name}</h1>
  )
}

export default App
```

---

## 5. Components (small reusable pieces)

Anything you reuse should be its own component. A component is just a function whose name starts with a **capital letter**.

Create `src/Greeting.jsx`:

```jsx
function Greeting() {
  return <p>Welcome to the app.</p>
}

export default Greeting
```

Use it in `App.jsx`:

```jsx
import Greeting from "./Greeting.jsx"

function App() {
  return (
    <div>
      <h1>Hello, React</h1>
      <Greeting />
    </div>
  )
}

export default App
```

`<Greeting />` means “put the Greeting component here.” You can use it more than once.

`import` / `export` is how files share components. `export default` means “this file’s main thing.” The other file imports it by path.

---

## 6. Props (data going in)

**Props** are how a parent component passes data to a child. They work like function arguments.

Update `Greeting.jsx`:

```jsx
function Greeting({ name }) {
  return <p>Welcome, {name}.</p>
}

export default Greeting
```

`{ name }` is **destructuring**: pull the `name` prop out of the props object.

Then in `App.jsx`:

```jsx
import Greeting from "./Greeting.jsx"

function App() {
  return (
    <div>
      <Greeting name="Ada" />
      <Greeting name="Grace" />
    </div>
  )
}

export default App
```

Each `<Greeting />` gets its own `name`. Same component, different data.

Rules that trip beginners:

- Props flow **down** (parent to child). A child cannot change the parent’s props.
- Prop names are yours. `name`, `title`, `count` — pick clear ones.
- To pass a number or variable, use braces: `count={3}` or `name={userName}`, not quotes.

---

## 7. State and clicks (`useState`)

**State** is data the component owns. When you update state, React **re-renders** that component: it runs the function again and updates the screen.

`useState` is a **hook**. You call it at the top of the component (not inside `if` or loops).

Replace `src/App.jsx` with a counter:

```jsx
import { useState } from "react"

function App() {
  const [count, setCount] = useState(0)

  function handleClick() {
    setCount(count + 1)
  }

  return (
    <div>
      <p>You clicked {count} times.</p>
      <button onClick={handleClick}>Click me</button>
    </div>
  )
}

export default App
```

What this means:

- `useState(0)` — start `count` at `0`
- `count` — the current value
- `setCount` — the function that updates it
- `onClick={handleClick}` — when the button is clicked, run `handleClick`

Notice `onClick`, not `onclick`. In JSX, event names are camelCase.

**Always update state with the setter** (`setCount`). Do not write `count = count + 1`. React will not notice that, and the screen will not update.

If the new value depends on the old one, this form is safer:

```jsx
setCount((current) => current + 1)
```

---

## 8. Forms and input

An input that React controls is a **controlled input**: the value lives in state, and every keystroke updates that state.

```jsx
import { useState } from "react"

function App() {
  const [text, setText] = useState("")

  function handleChange(event) {
    setText(event.target.value)
  }

  return (
    <div>
      <input
        value={text}
        onChange={handleChange}
        placeholder="Type your name"
      />
      <p>Hello, {text || "stranger"}.</p>
    </div>
  )
}

export default App
```

- `event.target.value` is the current text in the box
- `value={text}` makes the box show whatever is in state
- `{text || "stranger"}` shows `"stranger"` when `text` is empty

---

## 9. Lists

To show an array, use `.map()` and give each item a **`key`**. The key should be a stable id, not the array index if items can be reordered or deleted.

```jsx
function App() {
  const tasks = [
    { id: 1, title: "Install Node" },
    { id: 2, title: "Create a Vite app" },
    { id: 3, title: "Build a component" },
  ]

  return (
    <ul>
      {tasks.map((task) => (
        <li key={task.id}>{task.title}</li>
      ))}
    </ul>
  )
}

export default App
```

The `key` helps React match list items when the list changes. Missing keys cause a warning in the console.

---

## 10. Conditional rendering

Show different UI depending on data.

```jsx
function App() {
  const isLoggedIn = false

  return (
    <div>
      {isLoggedIn ? <p>Welcome back.</p> : <p>Please log in.</p>}
    </div>
  )
}

export default App
```

`condition ? a : b` is a ternary: if true, show `a`; else show `b`.

To show something **only if** a condition is true:

```jsx
{count > 0 && <p>You have clicked at least once.</p>}
```

---

## 11. Put it together: a tiny todo list

This uses components, props, state, events, lists, and a form. Replace `src/App.jsx`:

```jsx
import { useState } from "react"

function TodoItem({ todo, onToggle }) {
  return (
    <li>
      <label>
        <input
          type="checkbox"
          checked={todo.done}
          onChange={() => onToggle(todo.id)}
        />
        {todo.title}
      </label>
    </li>
  )
}

function App() {
  const [title, setTitle] = useState("")
  const [todos, setTodos] = useState([
    { id: 1, title: "Learn JSX", done: true },
    { id: 2, title: "Learn useState", done: false },
  ])

  function handleSubmit(event) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) {
      return
    }

    setTodos([
      ...todos,
      { id: Date.now(), title: trimmed, done: false },
    ])
    setTitle("")
  }

  function handleToggle(id) {
    setTodos(
      todos.map((todo) =>
        todo.id === id ? { ...todo, done: !todo.done } : todo
      )
    )
  }

  return (
    <div>
      <h1>Todos</h1>
      <form onSubmit={handleSubmit}>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="New task"
        />
        <button type="submit">Add</button>
      </form>
      <ul>
        {todos.map((todo) => (
          <TodoItem key={todo.id} todo={todo} onToggle={handleToggle} />
        ))}
      </ul>
    </div>
  )
}

export default App
```

Ideas worth noticing:

- `event.preventDefault()` stops the form from reloading the page
- `...todos` copies the old list, then you add a new item (do not mutate the old array)
- The child `TodoItem` does not change the list itself. It calls `onToggle`, and the parent updates state. That is a common pattern: **state lives in the parent, children send events up**

---

## 12. A tiny cheat sheet

```jsx
// Component
function Hello({ name }) {
  return <h1>Hello, {name}</h1>
}

// State
const [count, setCount] = useState(0)
setCount(count + 1)
setCount((n) => n + 1)

// Events
<button onClick={handleClick}>Go</button>
<input value={text} onChange={(e) => setText(e.target.value)} />

// List
{items.map((item) => (
  <li key={item.id}>{item.title}</li>
))}

// Condition
{isOn ? <On /> : <Off />}
{error && <p>{error}</p>}
```

Project commands:

```bash
npm install      # install dependencies
npm run dev      # start the local server
npm run build    # build files for production
```

---

## Common beginner problems

**“The page is blank.”**  
Open the browser console (right-click → Inspect → Console). A JSX error often means you returned two siblings without a wrapper, or used `class` instead of `className`.

**“Nothing happens when I click.”**  
You probably wrote `onClick={handleClick()}` (the `()` runs the function immediately). Use `onClick={handleClick}` so React can call it later. If you need arguments: `onClick={() => handleToggle(id)}`.

**“The screen does not update.”**  
You changed a variable without `setState`. React only re-renders when state (or props) change. Also: do not mutate arrays/objects in place; make a new one (`map`, spread `...`).

**“`useState` is not defined.”**  
Add `import { useState } from "react"` at the top of the file.

**“Hooks error / rendered more hooks than last time.”**  
Do not call `useState` inside `if`, loops, or nested functions. Keep hooks at the top of the component.

**“Each child in a list should have a unique key.”**  
Add `key={somethingStable}` on the outermost element inside `.map()`. Prefer an id, not the index, if the list can change.

**“`npm` / `vite` not found.”**  
Node is missing or the terminal was open before you installed it. Close the terminal, reopen it, run `node -v`. Use `npm run dev` inside the project folder (the one with `package.json`).

**“I changed a file and nothing happened.”**  
Confirm the dev server is still running (`npm run dev`) and that you saved the file. You should be editing files under `src/`.

---

## What to practice

Do this once in `my-first-react`:

1. Install Node and create the Vite React app.
2. Replace `App` with a heading and a paragraph (JSX).
3. Extract a `Greeting` component and pass it a `name` prop.
4. Add a counter with `useState` and a button.
5. Add a text input that greets you as you type.
6. Build the tiny todo list (add items, toggle done).
7. Break something on purpose (forget a `key`, call `onClick={fn()}`), read the error, then fix it.

When that feels familiar, you know enough React to start a real UI. Next topics you will meet later: more hooks (`useEffect`), sharing data across many components, and routing (multiple pages). They all sit on top of components, props, and state.
