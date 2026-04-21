---
notion-id: 28476cfe-b76d-8026-8766-f2ba048c50e8
---

**<u>**DOM - Document Object Model (page content)**</u>**

The [[DOM]] is always exactly identical to the HTML and displayed as a JS Object. It is a programming interface that can represent the page so that programs can change the structure, style, and content.

This representation as an object allows JavaScript to interact with and manipulate the content of a webpage. However, it's important to note that while the DOM reflects the HTML structure, it can be modified dynamically through JavaScript, creating differences between the original HTML document and the current DOM state. Provides you with an API to interact with it

We can interact with the DOM “document.”

- methods - functions that are attached to the doc objects 
    - querySelector - select a specific HTML element
    - getElementById - finds an element by its id
    - createElement - makes a new HTML element
These sort of methods don’t work unless we append() the method.
    - eventListener
- “sub” objects - when we select HTML element, object on the DOM and has its own methods and properties. eventListener
- properties - “style.color” 

HTML contains HTML and Head element. They’re arranged in a tree like structure.

<u>**BOM - Browser Object Model (browser controls)**</u>

If DOM is the page, the BOM is the browser environment around it. It allows JS to interact with the browser outside the webpage.

Common objects: window, navigator, screen, location, history. (window.alert(), location.reload(), history.back() )

<u>**Can you explain document.createElement & document.querySelector? **</u>

- createElement creates a new elements to the DOM and querySelector selects existing once.

<u>**Who invented Javascript and why?**</u>

Brendan Eich invented Javascript in 1995 while working at Netscape. (First version in 10 days!)

The goal was to make websites interactive by running small programs directly inside the browser instead of just static HTML.

<u>**JS Type Coercion**</u>

The `+` operator performs **string concatenation** if **either operand is a string**. 

Example: console.log(”5” + 2) The number `2` is converted to `"2"` and joined with `"5"`.

- `+` → string wins (concatenation)
- -, *, `/` → convert to numbers

<u>**What is a promise in Javascript?**</u>

- A promise is an object (placeholder) that may have an available value later, (now, later, or even never). It will either resolve or fail. (Javascript IOU) 
- resolve() once the value promise completes successfully and passes a value to .then()

<u>**How is Javascript single-threaded and how does promises work into this?**</u>

Javascript runs one tasks at a time, so Javascript offloads async tasks like fetch or setTimeout to the browser Web API so that they run in the background. Once they’re done, the event loop moves their callback or promise resolutions to the main queue so JS can continue to run smoothly without freezing.

The benefit of it being single threaded is there is no complex management but the downside is longer running-tasks can block the code.

<u>**What is fetch?**</u>

Fetch() is a built in JS method that lets you make network calls. It returns a promise. (won’t block your code while waiting for a response) Specifically HTTP requests.

<u>**What is Context API? What are some common uses for it?**</u>

- React’s built in way to share data across many components without prop drilling.
    - createContext, useContext, Provider. (Used for things like theme + Auth management)
    - Disadvantage of using this, it re-renders every single time. Not very performative. 

<u>**Explain different ways to manage global state in React. Why are they useful?**</u>

- Keep data in one place, update without prop drilling (passing data down through multiple nested components, even if some of the components do not directly use the data), avoid unnecessary re-renders, debug data more easily. Better for performance. 
- Redux & Zustand: 
    - Redux - used for larger scale applications, more setup & structure (actions, reducers, stores)
    - Zustand - uses direct functions, simple to use, small/medium apps (just functions)

These are just two examples of global state management in React.

- 3 + levels use a state library, anything less than that you can use context

<u>**Explain “hoisting” and scope. Describe var, let, and const and the difference between global vs. blocked scope. **</u>

Hoisting - When JS runs your code, it moves all variable and function declarations to the top of scope before executing anything. Only declaration is hosted, not the value. 

Scope - where a variable can be seen or used in your code.

- Global Scope - variable accessible anywhere in program
- Block Scope - variable accessible only inside the block they’re defined in

var - function scoped, hoisted(initialized as undefined), can be re-assigned

let - block scoped, hoisted(dead until declared), can be re-assigned - used for variables that change

const - block scoped, cannot be re-assigned, hoisted(dead until declared), must be assigned immediately

“`var` is **function-scoped** and initializes as `undefined`, while `let` and `const` are **block-scoped**, can’t be used before declaration, and stay safe inside their `{}`.” 

“if you try to use let or const before its declared, you get an error”

<u>**What is the factory pattern used for?**</u>

The **factory pattern** is used to centralize and simplify object creation, letting you make new instances without worrying about the details of how they’re built.

- Why it’s useful: 
    - Encapsulation: hides complex object creation logic
    - Flexibility: can return different object types based on conditions
    - Maintainability: if creation logic changes, you only update it in one place
    - Consistency: ensures objects are created in a uniform way

<u>**What is dependency injection? Tight coupling? Singletons? **</u>

Dependency injection - Design pattern used to pass dependencies in instead of creating them inside. Used for decoupling and simplifying testing. More reusable and less coupled (which could lead to tight coupling…

Tight coupling - When one class or function is too dependent on one another. Relies on internal behavior. You should avoid this. Makes code hard to maintain. “We try to loosen the coupling so each piece of code can evolve independently”

Singleton - A pattern where you ensure only one instance of a class exists across entire app and can be reused everywhere

<u>**What are secrets? How do we keep them private?**</u>

Secrets are sensitive values your app needs to function and should never be exposed to the public. (API Keys, database passwords, Auth tokens, encryption keys)

We keep them private by using environment variables secret managers (.env), Git ignore, management services like AWS, Vercel, Supabase Config. 

<u>**What’s the difference between REST and GraphQL?**</u>

REST (Representational State Transfer) uses multiple endpoints where the server defines the data you get, while GraphQL uses a single endpoint where the client specifics exactly what data it needs.

REST - simple and stable, best for small APIs. cacheable. 

GraphQL - powerful and flexible, best for complex frontends, always post to the GraphQL endpoint. There is only one method, only one endpoint. Only makes POSTS.

<u>**How would you decide on whether to use REST, GraphQL, or something like tRPC as your data fetching strategy?**</u>

Use **REST** when you want simple, widely supported APIs (especially public ones), **GraphQL** when clients need flexible queries for complex or nested data, and **tRPC** when you control both frontend and backend in a full-stack TypeScript app and want end-to-end type safety with minimal boilerplate.

tRPC - tRPC is a TypeScript framework that lets your frontend call backend functions directly with automatic type safety, removing the need for manually defined REST or GraphQL APIs.

![[Screenshot_2026-03-11_at_9.52.06_AM.png]]

<u>**What are events in Javascript and how do they work?**</u>

Events in Javascript are things that happen in the browser that your code can react to. The browser detects something, it creates an event object with details (elements, keys, etc., it sends that event through the DOM, and if you’ve attached an event listener, your function will run. 

<u>**How to determine if you’re in a browser or NodeJS in Javascript?**</u>

typeof - “window” only exists in browsers and “process” exists only in Node.js

(either console.log or creating a variable)

You’ll often use this in Next.js to make sure code that touches localStorage or “document” only runs client-side. 

Libraries - when something behaves differently server vs. client

SSR (Server-side fetching) - to avoid errors like “window is not defined” 

<u>**Supabase uses an RPC style API? What does that mean? What’s the difference between RPC and REST and GraphQL?**</u>

RPC (Remote Procedure Call) - Calling a function on the server as if it were a local function. It is action-based, not resource-based. So in Supabase, you write a Postgres function and Supabase exposes it as an API endpoint. “POST /rest/v1/rpc/my_custom_function”

REST (Representational State Transfer) - resource based(user, posts, goals), uses HTTP Verbs (Get, Post, Put, Delete). URLS represent nouns, not actions

==GET /goals
POST /goals
GET /goals/123
DELETE /goals/123==

Supabase automatically generates REST endpoints for each table…

GraphQL - query-based, client asks for exactly what field it needs, only one endpoint, solves “overfetching problem”

Supabase CAN support GRaphQL if you enable the postgres extension. 

==Use RPC when:==

- ==You need ====**complex logic**==== that’s better done in SQL/PLpgSQL==
- ==You want to avoid multiple round trips==
- ==You want ====**better performance**==== (logic runs on DB server)==
- ==You want granular control over logic==
- ==You want “action-based” endpoints==

==Examples:==

- ==“Mark all expired goals as complete”==
- ==“Calculate streaks for this user”==
- ==Multi-table joins with custom behavior==
- ==Custom validations==
- ==Aggregations and analytics==

==REST: great for simple CRUD==

==RPC: great for custom logic==

==GraphQL: great for apps with flexible UI data needs==

Supabase is a collection of other open source projects. Which ones are they?

- [Postgres](https://www.postgresql.org/) is an object-relational database system with over 30 years of active development that has earned it a strong reputation for reliability, feature robustness, and performance.
- [Realtime](https://github.com/supabase/realtime) is an Elixir server that allows you to listen to PostgreSQL inserts, updates, and deletes using websockets. Realtime polls Postgres' built-in replication functionality for database changes, converts changes to JSON, then broadcasts the JSON over websockets to authorized clients.
- [PostgREST](http://postgrest.org/) is a web server that turns your PostgreSQL database directly into a RESTful API.
- [GoTrue](https://github.com/supabase/gotrue) is a JWT-based authentication API that simplifies user sign-ups, logins, and session management in your applications.
- [Storage](https://github.com/supabase/storage-api) a RESTful API for managing files in S3, with Postgres handling permissions.
- [pg_graphql](http://github.com/supabase/pg_graphql/) a PostgreSQL extension that exposes a GraphQL API.
- [postgres-meta](https://github.com/supabase/postgres-meta) is a RESTful API for managing your Postgres, allowing you to fetch tables, add roles, and run queries, etc.
- [Kong](https://github.com/Kong/kong) is a cloud-native API gateway.

What is firebase?

A backend-as-a-service made by Google. It makes it easier so you dont have to build things like database, auth, file storage, apis/hosting. NOSQL document storage. 

Example : 

users
user123
name: "Chelsey"
score: 1200

Most people prefer Supabase because it uses SQL which is easier for harder data. 

![[Screenshot_2026-03-04_at_10.27.58_AM.png]]

Relational: data is organized in tables and rows. You can define relationship between the tables. 

Example: 

- - Create a table
CREATE TABLE products (
id SERIAL PRIMARY KEY,
name VARCHAR(200),
price DECIMAL(10,2),
in_stock BOOLEAN
);
- - Insert data
INSERT INTO products (name, price, in_stock)
VALUES ('Laptop', 999.99, true);
- - Query data
SELECT * FROM products WHERE price < 1000;

SELECT city, COUNT(*) as customer_count, AVG(age) as avg_age
FROM customers
WHERE age > 18
GROUP BY city
HAVING COUNT(*) > 2
ORDER BY customer_count DESC
LIMIT 5;

The example above are the most common clauses used.

**Key differences to remember:**

- **WHERE** filters individual rows (before grouping)
- **HAVING** filters groups (after GROUP BY)
- **ORDER BY** always comes near the end
- **LIMIT** is always last

Always create an index anytime you use WHERE

<u>**What is indexing?**</u>

An index is a separate data structure that stores a sorted copy of specific columns from your table. Along with pointers to the full rows.

[https://www.youtube.com/watch?v=bBu_V8CfWgM](https://www.youtube.com/watch?v=bBu_V8CfWgM)

You can read data faster at the cost of slightly slower writes. You would create them on columns you’d be search/sort frequently.

B-Tree (Balanced Tree) self-balancing tree structure: 

GIN Index (Generalized Inverted index) : 

Hash Index: 

**PostgreSQL will use an index when:**

- The query filters on an indexed column: `WHERE rating = 5`
- The query sorts by an indexed column: `ORDER BY created_at DESC`
- The query joins on an indexed column: `JOIN ON books.id = reviews.book_id`
- The query uses a function that matches an expression index



<u>**What are public/private/protected properties in classes?**</u>

Public - anyone can access this (inside, outside, subclasses)

“I want other code to directly use this”

Private - only the class itself can access this. This presents the rest of the app from messing with sensitive or internal data.

Protected - Only the class AND subclasses can access this.

Classes are meant to hide complexity and protect logic. This is called encapsulation. It prevents bugs and forces cleaner design. 

==class BankAccount {
public owner;          // anyone can read this
private balance = 0;   // only class can change this
protected pin = 1234;  // child classes can use it==

==constructor(owner) {
this.owner = owner;
}==

==deposit(amount) {
this.balance += amount;
}
}==

==class SavingsAccount extends BankAccount {
checkPin() {
console.log(this.pin); // works (because protected)
}
}==

==const acct = new BankAccount("Chelsey");==

==console.log(acct.owner);   // ok
console.log(acct.balance); // ❌ error (private)
console.log(acct.pin);     // ❌ error (protected)==

OOP - Object-Oriented Programming - organize everything into objects. Little bundles that contain data (properties) and behavior (methods/functions)

# HTML Basics

<u>**What is a div? **</u>

A container in HTML. It is used to group elements together so you can style with CSS or target with JS.

<u>**What is a block level element?**</u>

HTML element that takes up full width of the parent container and always starts on a new line. 

<u>**Name a couple deprecated HTML elements and why they are deprecated?**</u>

<font>, <center>, <big/small>. They were deprecated because we now use CSS for styling. Mixes the semantics with the markups of the display. 

<u>**Who invented the <image> tag and what is he doing now?**</u>

Marc Andreseesen in 1993 while working on the Mosaic browser. Co-founder of Netscape and now a major figure in tech.

## HTTP Basics

<u>**What is HTTP? What is HTTPS? (HyperText Transfer Protocol/Secure)**</u>

Communication system (protocol) of the web. It’s how your browser and web server talk to each other. Your browser sends a request to the server, and the server replies with an HTTP response.

Request & response - browser asking for something and the server sending something back

HTTPS is encrypted with SSL/TLS (protects from hackers/interceptions)

SSL (Secure Sockets Layer) / TLS (Transport Layer Security)  - security protocol that provides an encryption connection between browser and server. Secret encryption key.

- HTTP Methods(Verbs): (Tell the server what kind of action you want to perform)
    - GET(retrieve data), POST(send new data), PUT(replace existing data), PATCH(update part of data), DELETE(remove data)
    - “CRUD” = Create(Post), Read(Get), Update(Put/Patch), Delete
“Start line” - Method/Target/Version of HTTP - Request
“Start line” - Version/Status Code/Status Text - Response
*Stateless Request*
- HTTP Status codes: (Server reply with a status code to tell you what happened)
    - 100 - Continue. 200- Ok. 201-Created. 301- Moved, 302- Found, 400-client error, 5xx- server errors
- HTTP Headers: (Send extra info about the request or response)
Headers are key-value pairs that travel with every request and response. Sticky notes to tell the browser/server how to handle the message.
Request Headers: 
Response Headers:
    - Content-Type: tells browser what type of data it’s receiving
    - Cache-Control: how the browser should cache response
    - Set-Cookie: tells browser to store a cookie
    - Access-Control-Allow-Origin: handles CORS (cross-site requests)
    - Content-Length: how big the response body is

<u>**What is the Accept header do? What is a MIME type?**</u>

When your browser makes a HTTP request to the server(fetch()), it sends a bunch of headers, the Accept header tells the server what formats the client accepts as a response. 

MIME - Multipurpose Internet Mail Extensions - “Here’s what kind of content this is” - standardized labels for content formats

CORS (cross-origin resource sharing) - prevents bad sites from secretly making requests to other sites, safety lock to protect users (using headers like Access-Control-Allow-Origin)

<u>**How does DNS work?**</u>

DNS is the system that converts a website’s name into the numerical address your computer needs to reach it. “Translates domain names into computer-friendly IP addresses.”


<u>**Who invented the World Wide Web? What is the difference between WWW and the internet?**</u>

The World Wide Web was invented by Tim Berners-Lee in 1989.  It was invented at CERN. 

The internet (1960’s, government project ARPANET which connected university computers to share data) is the global network of connected computers, routers, and protocols that enables data to travel between two machines.

The WWW, (Web) is a system of interlinked webpages accessed via HTTP over that network. (Server with HTML pages)

The internet is the highway and the Web is a car driving on it. 

<u>What is Gzip? What is ZIP?</u>

GZip is a compression algorithm that shrinks files before sending them over the internet. Standard web compression. 

“compress this one single file for faster transmission”

ZIP is a file compression format + container you’re used to on your computer.

“compress + bundle these files into one package”

- Next.js and Vercel use Gzip under the hood to compress your assets

<u>**Debugging concepts **</u>

- **Reproduce the bug** consistently
- **Read the error message** fully
- **Isolate the issue** to the smallest piece of code
- **Use breakpoints** to step through code
- **Follow the data** from input → output
- **Check assumptions** (is the code doing what you think?)
- **Look for edge cases** (null, empty, off-by-one)
- **Check logs and the network tab**
- **Use a scientific method** (test one thing at a time)
- **Google the error** — someone else hit it too

DevTools: 

- **console.log** → quick value checks
- **console.error** → highlight real problems
- **debugger** → freeze code at exact point
- **DevTools Elements** → fix layout/CSS
- **DevTools Console** → see logs & test JS
- **DevTools Sources** → breakpoints + step through code
- **DevTools Network** → debug API calls
- **DevTools Application** → cookies, storage, caches

# React Questions

<u>**In React, when to lift state up vs prop drilling?**</u>

Lift state up when multiple components need to share the same data, but if you’re just passing down 1 or 2 levels, then prop drilling is fine. Anything more you would consider using a global or state management library (ie. ContextAPI, Zustand, Redux.)

<u>**How do you prevent unnecessary re-renders in React?**</u>

Keeping state local, using React.memo, useCallback(), useMemo() so the props aren’t constantly changing.

React.memo - wraps component and prevents from re-rendering unless props change “don’t redraw me unless something new happens”

useCallback - saves a function reference so it doesn’t get recreated every render

useMemo- saves the result of a calculation so it doesn’t run every render

<u>**How do you measure and improve performance in React applications?**</u>

You can measure React performance using DevTools, keeping state local, avoiding unnecessary re-renders or large data loads.

<u>**Why do keys in lists matter in React?**</u>

Keys give React a stable identity for each element, making updates faster and preventing bugs when lists change.

<u>**How is shadCN(Radix+Tailwind) different than MaterialUI?**</u>

MUI is a fully styled component with predefined themes, “plug and play components with a built in look.” shadCN is like a design starter kit, you own the code and components are copied into your project and not installed from a package. 

<u>**What’s the advantage to using a service class over calling fetch directly in components?**</u>

Composability, testability, error handling, seperation of concerns…

A service class keeps all your API logic in one place, instead of scattering fetch() calls everywhere inside components.  Keeps your components focused on UI and pulls all network logic into a single, reusable, testable layer. 

<u>**What does separation of concerns mean?**</u>

Dividing your code so each part has one clear job, instead of one big chunk doing everything. This makes code easier to understand, test, and maintain. 

<u>**Why do we use libraries like SWR and react-query? What does SWR mean? What is it? Why?**</u>

SWR - stale while revalidate. It was created by Vercel. It is a data fetching hook that makes it easy to fetch data from an API, keep it fresh & fast, handle caching, revalidate, refetching, and error states for you automatically. 

Stale - show the cached data immediately so your UI doesn't flicker/feel slow

While Revalidate - in the background, SWR fetches fresh data and updates the cache once it’s done

The user will always see something right away, but SWR ensure it’s up to date.

We use SWR or react-query simply because React doesn’t handle data fetching or data management. You can fetch data with fetch(), but then there is a lot more to go along with it. They let you treat server data like React state, but with less boilerplate.

<u>**What’s the difference between Supabase browser and server client? **</u>

Server side (service client) - api routes, server actions, backend logic: 

(user actions, SWR, auth)

Browser side (browser client) - frontend components, client hooks, user-facing pages

(admin logic, seeding, api routes)

### <u>**What is a database webhook? **</u>

When something changes in your database, it automatically sends a message (HTTP request) somewhere else. 

## What actually triggers a webhook?

In Supabase, webhooks fire on database events like:

- `INSERT` → new row created
- `UPDATE` → row changed
- `DELETE` → row removed

You can attach them to a table like:

- `users`
- books
- `goals`

## Simple mental model

- Database = **event source**
- Webhook = **messenger**
- Your API = **brain**
- AI = **decision maker**
- Tools (email, etc.) = **actions**

That’s literally an agent pipeline.

<u>**Explain mapSupabaseError. What does it do and why do we use it?**</u>

A translator between Supabase’s error and your app’s error system. It is a utility function you write that takes the error object Supabase gives you and maps it into something nice, more useful for your app. 

We use it for consistency, user-friendly messages, centralized error handling, better debugging, improves maintainability. We use it inside Service classes. 

# <u>**Testing Questions**</u>

Testing is super helpful because it keeps you from accidentally breaking stuff when you refactor, add new features, or make a tiny tweak. It gives your project stability and avoids bugs in production. It also can help you think more clearly about how your code is suppose to work.

Vitest, Jest, React Testing Library (RTL) are some popular testing libraries. 

Vitest handles unit + integration tests. Good for services, utilities, React components

![](https://www.youtube.com/watch?v=CxSL0knFxAs)

Jest is an order testing library - it does the same jobs that Vitest does, you’d really see it in older codebases, tutorials, createreactapp. 

React Testing Library (RTL) - This is a React component testing tool. It does NOT run a test. It is for interacting with the React components the way a user would interact with them. It is for testing behavior, not internal state. It avoids testing details, and uses query elements like a user would, “getByRole, getByText, getByLabelText”

==render(<Button />)
const btn = screen.getByRole("button", { name: /save/i })
await user.click(btn)
expect(mockSave).toHaveBeenCalled()==

(Example of RTL and Vitest working together.)

Cypress is a E2E browser testing tool. This is for full-workflow testing. 

In testing, we mock API calls, service methods, database operations, expensive functions, network requests. It basically lets you isolate things so you’re testing the code, not someone else’s. 

# GitHub Actions

GitHub Actions is a continuous integration and continuous delivery (CI/CD) platform that allows you to automate your build, test, and deployment pipeline. You can create workflows that build and test every pull request to your repository, or deploy merged pull requests to production.

CI (Continuous integration) - Software practice that requires frequently committing code to a shared repo. Committing code more often detects errors sooner and reduces the amount of code a developer needs to debug when finding the source of an error. Frequent code updates also make it easier to merge changes from different members of a software development team. This is great for developers, who can spend more time writing code and less time debugging errors or resolving merge conflicts. 

GitHub runs your CI tests and provides the results of each test in the pull request, so you can see whether the change in your branch introduces an error. When all CI tests in a workflow pass, the changes you pushed are ready to be reviewed by a team member or merged. When a test fails, one of your changes may have caused the failure.

CD (Continuous deployment) - the practice of using automation to publish and deploy software updates. As part of the typical CD process, the code is automatically built and tested before deployment.

You can set up a GitHub Actions workflow to deploy your software product. To verify that your product works as expected, your workflow can build the code in your repository and run your tests before deploying.

[https://www.youtube.com/watch?v=AknbizcLq4w](https://www.youtube.com/watch?v=AknbizcLq4w)

[https://docs.github.com/en/actions/concepts/workflows-and-actions/workflows](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflows)

<u>**Merging/Development strategies**</u>

Branches: 

MVP vs full-scale-product


# <u>**AI & IDE**</u>

IDE (Integrated Development Environment) - Think of it like a workbench

- write code, run it, debug, manage folders/files/dependencies
- vsc, xcode/android are common
- auto complete, syntax highlights, error squiggles, debugging tools
- **AI in IDEs** to write better code faster
- **AI agents** to perform tasks, manage workflows, and free up time
- **AI general models** for research, creativity, decision support


[https://www.youtube.com/watch?v=KVXhTZ4HwCM](https://www.youtube.com/watch?v=KVXhTZ4HwCM)

ClaudeCode - build, debug, and ship right from your terminal

[https://addyo.substack.com/p/my-llm-coding-workflow-going-into?triedRedirect=true](https://addyo.substack.com/p/my-llm-coding-workflow-going-into?triedRedirect=true)

# Core Workflow Principles

1. Plan before you code
    1. do not start with “write this app!” instead, create a spec doc with: 
    - Requirements
    - Architecture decisions
    - Data models
    - Test strategy
2. Break tasks into smaller chunks
    2. scope is so important
    3. feed small, manageable tasks
    4. code in iterations: one step, test, next step
    5. keep ai from “hallucinating huge code dumps”
3. provide good context
    6. include relevant files + docs
    7. explicitly tell it to not touch something or avoid something!
4. choosing the right model
    8. try multiple when needed
5. stay in the loop
    9. read it
    10. run it
    11. test it
6. git habits are very important
    12. commit often with meaningful messages
    13. use it as a checkpoint
    14. helps review and restore confidently


“Post Mortem” - A structured breakdown of: 

## <u>**The Proper Workflow: Local → Staging → Production**</u>

The problem with developing directly in production is every change you make immediately affects real users, real data, and operations. A small mistake can cause downtime, data loss, or security vulnerabilities.

How professional development typically works: 

7. Local Development environment - This is where you experiment, break things/fix them, use separate database with fake/test data. No one is affected by your mistakes.  
8. Staging environment (optional, but recommended) - A near exact copy of prod, used for final testing before development, helps catch issues that only appear in prod-like conditions
9. Production environment - The live system your users interact with, only receives tests, reviewed, approved code. Changes are deployed through automated processes. 


## <u>**Shells, variables, directory structures…**</u>

Shells - CLI that lets you interact with the OS. It’s a program that takes commands, interprets, and tells OS what to do. (bash, zsh, sh) 

Variables - In shells, variables store data you can reuse.

**What are the main differences between ClaudeCode and Opencode?**

Claude Code - 

- Uses Haiku (fast, cheap) for simple searches
- Uses Sonnet for standard coding tasks
- Uses Opus for complex multi-file changes
- Context gathering - scans repo structure, identifies key files

![[image.png]]

How do I talk to an AI to get better output results?

- **Be specific**
    - “Build an auth system” = chaos.
    - “Email/password auth using existing User model, Redis sessions, middleware for /api/protected” = usable output.
- **Say what NOT to do**
    - Models (especially Claude 4.5) love to overengineer.
    - If you want simple, *say so*: minimal files, no abstractions, keep it lean.
- **Always review output**
    - AI will introduce technical debt if you let it.
    - You are still the adult in the room.
    - 
    ### **Context Changes Everything**
    - Explain **why**:
        - “Runs on every request” → prioritize performance.
        - “Prototype we’ll throw away” → speed > perfection.
    - AI can’t infer constraints you don’t state.
    - 
    ### **How to Get Better Results**
    - Write better prompts:
        - Specific > vague
        - Constraints > open-ended
        - Examples > descriptions
    - Structure requests:
        - Break complex tasks into steps.
        - Agree on architecture before coding.
        - Review, iterate, refine.
    - Provide full context:
        - State assumptions explicitly.
        - Don’t expect mind-reading.

What is an IDE? 

IDE = Integrated development environment

it’s a single app that bundles everything you need to write, run, debug code

(VSC)

<u>**What is a worktree?**</u>

A worktree is basically multiple working folders tied to the same repo. 

## **SQL**

<u>**What is a database? **</u>

A database is nothing more than a set of related information.

<u>**What is temporal data?**</u>

Data that is tied to time. Meaning the time when something happened, changed, or was valid is an important part of the data.

Data + time context.


<u>**What is SQL? **</u>

SQL - “structured query language” (what people insist it means) - how you communicate with databases. When learning, starting with simple SELECT queries and adding WHERE clauses as you go along. 

<u>**What is SQLite?**</u>

It is a database engine. It is software that allows users to interact with a relational database like SQL.

- a database is stored in a single file (different from other database engines)
    - makes for great accessibility
- cons: SQLite’s signature portability unfortunately makes it a poor choice when many different users are updating the table at the same time (to maintain integrity of data, only one user can write to the file at a time).


## <u>**PosgreSQL**</u>

PostgreSQL is a relational database — it stores data in tables with rows and columns, like a spreadsheet with strict rules. PostgreSQL is a database server that stores structured data on disk, executes SQL queries sent by applications, and returns results while enforcing schema rules, relationships, and data integrity.

How does PostgreSQL work?

10. runs as a server process. when you install, it starts a background service on your computer. usually on port 5432.
11. when a app (express api) needs data, it will send a sql query. that query travels over a network connection to postgresql. even if its on same machine. it will always use client > server connection
12. postgresql parses the query - it’s checking if: 
    1. is the syntax valid?
    2. do the tables exist?
    3. do permissions allow this query
        1. example: SELECT * FROM users - Postgres verifies the users table exists
13. the query planner decides the fastest way to run it. it decides: 
    4. should it scan the whole table?
    5. should it use an index?
    6. should it join tables first?
14. postgres reads data from disk - tables are stoned as binary files on disk
15. postgres executes the query. example operations: 
    - filtering rows
    - joining tables
    - sorting results
    - aggregating data
16. postgres returns results - results are sent back to your app. your backend then converts it to jason for the frontend

- A database is a container for tables
- A table stores data in rows & columns
- A row is one record in a table
- A column is a field with a type
- A primary key uniquely identifies a row
- A foreign key links tables together. *This is how relational databases relate data.*
- 

[`DISTINCT`](https://www.codecademy.com/resources/docs/sql/commands/select-distinct?page_ref=catalog)` `is used to return unique values in the output. It filters out all duplicate values in the specified column(s).

| Type | What it’s for |
| --- | --- |
| `TEXT` | strings |
| `INTEGER` | whole numbers |
| `BOOLEAN` | true / false |
| `TIMESTAMP` | date + time |
| `DATE` | date only |
| `UUID` | unique IDs |
| `JSONB` | structured JSON (Postgres flex 💪) |
|   |   |

---

CRUD

Create - Insert data

Read - Select data

Update - Change data

Delete - Remove data

Where Clause - filtering data

Order By + Limit - Sorting & pagination

Indexes (performance) - make reads faster (typically used with emails, foreign keys, frequently filtered columns)

JOIN Types (most common are INNER JOIN, LEFT JOIN)

| Join | Meaning |
| --- | --- |
| `INNER JOIN` | only matching rows |
| `LEFT JOIN` | all left rows + matches |
| `RIGHT JOIN` | all right rows |
| `FULL JOIN` | everything |

SQL Views -

A view is a saved query that behaves like a table. Instead of writing a big query every time, you store it.

Why are these useful?

17. simplify complex queries
18. hide columns
19. computed columns

Transactions - ensure all operations succeed together

Constraints - keep your data clean

Aggregations - used for analytics

JSONB (postgres superpower) - store flexible data inside structured tables

<u>**How it Stores Data**</u>

When you created the users table, PostgreSQL created a structured file on your disk (at /opt/homebrew/var/postgresql@16/). When you insert a row, it
writes the data to that file in an optimized binary format — not plain text, so it can read/write fast.

Every table has a schema (the column definitions you wrote). PostgreSQL enforces this — if you try to insert a user without an email, it rejects it. If
you try to insert a duplicate username, it rejects it. This is a big deal. Your data stays clean and consistent.

<u>**How You Talk to It**</u>

PostgreSQL runs as a background service on your Mac (that's what brew services start did). It listens on port 5432. When your Express app or TablePlus
connects, they're sending SQL (Structured Query Language) to that service over a network connection — even though it's all on your machine.

<u>**What is Express.js?**</u>

Express (minimal web framework for Nodejs) - minimal, flexible, tons of tutorials - you can build a lot of structure yourself. This is great if you’re learning backend fundamentals and your app is small to medium and don’t need a lot of “framework magic” 

- Node by itself can run servers using the built-in **Node.js** `http` module, but doing everything manually is painful.
- Routing, middleware, request/response helpers, easy api building
- Express is basically three things:
    - server - node process listening for requests. When someone hits your API, express receives the request
    - routes (api endpoints) - routes define what happens when someone hits a URL
    - middleware - code that runs between the request and the response. it will parse json in requests. (auth, logging, validation, error handling)

Express is the bridge between the frontend and the database (PostgreSQL)

app - your server instance

routes - http method + url → function

Frontend
↓
HTTP request
↓
Express (routes + logic)
↓
PostgreSQL
↓
JSON response

<u>**Some other Node.js backend frameworks? How are they different? How would you choose one?**</u>

- Fastify - something like Express but more modern, cleaner plugin architechture. Twice as fast as Express. Written by one of the Node.js maintainers and built from the ground up to replace Express. good for performance focused API’s
- NestJS - can use either Express or Fastify under the hood. good for larger applications.
- Koa - you dont want the baggage of Express - minimal framework. created by Express team

For most normal apps, performance differences matter less than architecture and developer experience.

Some things to consider before choosing…

- Is this for learning backend?
- How big is the app going to get? 
- How comfortable am I with backend concepts already?

But basically:

- **I want to learn backend fundamentals clearly** → **Express**
- **I want a modern lightweight API** → **Fastify**
- **I want strong structure for a bigger app/team** → **NestJS**

Express is very popular because it is: 

- simple
- flexible
- lightweight
- huge ecosystem
- 

Customer (Frontend)
↓
Waiter (Express)
↓
Kitchen (PostgreSQL)
↓
Waiter returns food
↓
Customer receives result




# <u>**What is cloud storage? Why does it exist and what are the problems it solves?**</u>

A highly durable, scalable, distributed file system designed specifically for larger files. It solves problems your app server shouldn't have to think about. 

Durability (Files wont dissapear) Providers replicate your files across multiple machines and data centers.

if one server explodes its not a big deal, there are copies elsewhere

“object storage durability”

scalability cloud storage automatically scales bandwidth and distribution. 

offloading your app server - 

Your Express server should:

- Handle auth
- Handle API requests
- Generate signed URLs
- Manage metadata

It should NOT:

- Stream 4K video
- Handle 10GB uploads
- Serve large static files

Cloud storage takes that burden away.

cost efficiency - 

CDN - content delivery network 



“if you host files on a sever, the hard drive has a maximum size

also, if the hard drive fails you're fucked

so you need to keep backups

also, if your server is in Virginia, and someone from Japan wants your file, it's slower for them than for a Virgnian, that's where a CDN-fronted cloud storage comes into place

it makes copies of your videos all around the world, trivially

something you could not set up easily yourself”


# <u>**Object Storage (YT Project as examples below)**</u>

Object Storage holds the file. Your database holds the truth about the file.

Database will store: 

Object storage will store: 

Pattern 1 : “db stores the pointer” This is used everywhere and the baseline pattern.

With using a key you can swap cloud later without having to rewrite rows. URLs can change, keys dont

- a file is called an object
    - an object has a bucket (container)
    - key (path + file name)
    - bytes (the file itself)
Bucket: my-video-app
Key: videos/9f2a7d23.mp4

“We store files in object storage and keep only metadata and the object key in Postgres, which lets us scale storage independently from the database.”

signed URL’s - temporary permission to slip to a specific file.
“Anyone holding this exact URL is allowed to do **this one action **on **this one object **for t**his much time**.”

    ## The core idea (burn this in)
> **Your server signs the URL.
The browser uses the URL.
Storage trusts the signature.**

The browser never gets credentials. Ever.



Pattern 2: “two step upload” 

20. client asks api “where do i upload?”
21. api returns presigned PUT URL + key
22. client uploads directly to object storage
23. client tells api “uploaded → creates/updates DB row
- this is a good idea because it scales cleanly, cheaper, and your express server doesnt become a video pipe?

## Why saving videos in Postgres is a bad idea (quick reasons)

- bloats backups and migrations
- slows queries / vacuum / replication
- expensive storage compared to object storage
- harder to serve efficiently (range requests, CDN, etc.)
- you lose the natural “serve file directly” advantage of browsers/CDNs

Postgres *can* store blobs. It just shouldn’t for this.

GET URL’s : 

When your watch page loads:

- Call Express
- Express checks permissions
- Express generates signed GET URL
- URL expires in 60 seconds
- Browser streams directly from R2

Important:

The video keeps playing even after expiration.

Expiration only matters when requesting the file.

# **Canvas & Blob Concepts**

What is Canvas?

A <canvas> is an HTML element that lets you draw graphics with JavaScript. Think of it as a blank image you can paint on
programmatically.

<canvas id="myCanvas" width="300" height="150"></canvas>

const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');  // "context" = your paintbrush

Key idea: Canvas is just pixels. You can draw shapes, text, images — or frames from a video.

---

Drawing a Video Frame to Canvas

Here's the magic part — you can draw the current frame of a <video> element onto a canvas:

const video = document.querySelector('video');
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

// Set canvas size to match video
canvas.width = video.videoWidth;
canvas.height = video.videoHeight;

// Draw the current video frame onto the canvas
ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

Now canvas contains a still image of whatever frame the video is showing.

## <u>**What is a Blob?**</u>

A Blob (Binary Large Object) is raw binary data in JavaScript. It represents a file in memory — before it has a name or is saved anywhere. A file is just a blob with extra info.

Blob vs file - Raw binary data. File is blob + name + metadata

![[Screenshot_2026-02-11_at_3.55.12_PM.png]]

R2/S3 Organization

- Folders are just key prefixes - videos/file.mp4 and thumbnails/file.jpg
- Same bucket is fine for related assets with same access patterns
- Separate buckets only needed for different policies, regions, or billing

# <u>**Transcoding**</u>

Making multiple version of a video. coverting a video from one format into other formats.

For compatibility, you want HLS (adaptive streaming)

HLS - HTTP Live streaming (created by apple) - It is a way to stream video in small chunks instead of one giant file.

when a video is uploaded, your backend accepts the file, sends it to transcoder (ffmpeg or a cloud service) and then will create multiple versions. 

- Resolution - 4K → 1080p → 720p → 480p → 360p
- Bitrate - How much data per second (affects quality & file size)
- Codec - The compression algorithm (H.264, H.265, VP9)
- Container - The file format (.mp4, .webm, .mov)

The bitrate ladder (set of qualities)

- 240p ~ 300–500 kbps
- 360p ~ 700–1,000 kbps - mobile / weak signal
- 480p ~ 1,200–1,800 kbps - slower connections
- 720p ~ 2,500–4,000 kbps - normal wifi
- 1080p ~ 4,500–8,000 kbps - fast internet

### The “bitrate ladder” you should start with

Don’t overdo it. Start with 3–4 renditions:

- **360p** (slow internet hero)
- **480p** (nice mid)
- **720p**
- (optional) **1080p**

If you skip 360p, slow users will buffer forever and hate you personally.

### Segment duration

Use **4 seconds**. It’s a sweet spot.

Why do we transcode? 

Create smaller versions of a video if the user has slower internet, lower bitrate = faster loading

A video file has:

- 🎥 Video codec (H.264, H.265, AV1)
- 🔊 Audio codec (AAC, Opus)
- 📦 Container (MP4, MKV, WebM)

Transcoding changes one or more of those.

# <u>**Adaptive Switching**</u>

The player bouncing between those version so slow people have access. This is how the player chooses the quality. Start at a normal level, download a segment, estimate bandwidth based on download time, switch level up/down for the next segment

The player starts low, measures bandwidth, then switches up/down mid-playback. That’s adaptive bitrate streaming (ABR)

Why this matters: ABR only works well if you include **low enough** renditions for truly slow connections.

<u>**What is FFmpeg? **</u>

It is an open-source command line tool that converts video formats, compresses video, resizes video, extracts audio 

- Key flags:
    - i = input file
    - vf "scale=1280:720" = resize to 720p
    - b:v 2500k = video bitrate (quality/size tradeoff)
    - c:v libx264 = video codec
    - y = overwrite output file
- 

Input → Filters → Encoder → Output

<u>**What is Redis?**</u>

Redis is an in-memory database that is very fast. “Supercharged dictionary” that: 

- lives outside your app
- survives server restarts
- can be shared between multiple servers
- caching - store frequently used data
- session storage - user login session
- job queues - stores tasks to be processed
- real-time features - publisher/sub messaging

app > redis > postgresql

What is a Job Queue?

A to-do list for your server.. 

Transcode video 6 > Heres video 6 (meanwhile 6, 7, …) Done with 6, Transcodes.

Can retry jobs automatically, can run multiple in parallel, prioritize certain jobs, schedule for later, monitor progress

This is where BullMQ comes in… it is the most popular job queue for Node.js + Redis.

**BullMQ** is a **Node.js job queue system** that uses **Redis** to manage background tasks.

- Queue - Where jobs are stored
    - Producer - Code that adds jobs to the queue
    - Worker - Code that processes jobs from the queue
    - Job - A single task with data

## Why Redis Is Used

BullMQ stores everything in **Redis** because Redis is:

- extremely fast
- persistent
- shared between servers
- good for queues

Redis handles:

- job storage
- job state
- retries
- priorities
- delays

What would happen to your job queues when Redis restarts?

What is Redis cluster?

A Redis cluster is a group of Redis servers that share the data. 

![[Screenshot_2026-03-10_at_2.27.09_PM.png]]

# Redis Cluster + BullMQ

When BullMQ runs on a Redis cluster:

- workers connect to the cluster
- jobs are stored across multiple nodes
- workload scales horizontally

Benefits:

- more memory
- higher throughput
- better fault tolerance


A serverless function is a backend function that runs when someone makes a request — without you managing a server.

Normally (traditional backend):

- You spin up a server
- It stays running
- It listens for requests
- You pay for uptime

With serverless:

- There is **no always-on server**
- Your function wakes up when called
- It runs
- It shuts down
- You pay for execution time

It’s “serverless” for you — but obviously servers exist somewhere. You just don’t manage them.

What is Laravel?

A backend web framework for PHP that can help developers build web apps faster and a more organized way.

PHP - the language

Laravel - the toolbox + structure that makes it easy

Laravel is used to build the **server side of websites and apps**, such as:

- APIs
- authentication systems
- dashboards
- ecommerce sites
- SaaS apps
- full websites