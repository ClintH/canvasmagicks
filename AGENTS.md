We're connecting with the Canvas API. It's documented in canvas-api.txt

As you add commands or options, make sure the USAGE.md file is updated.

We want utmost safety of data. Write code that is very careful to validate it is editing what it should be, deleting what it should be and so on. Make sure that the --dry-run flag is always respected above all else.

Always run a typescheck when you're done and make sure it passes. Don't cut corners by typing things as any etc.

Favour a functional programming style. If you write a function that seems general purpose, put it into a './util' folder rather than embedding it into other places.