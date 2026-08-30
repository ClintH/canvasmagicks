Add a new 'export' subcommand for 'page'. If there is a 'target' page, just export it. Otherwise export all pages for the target course.

Prompt the user for an output path, if the --output path is not provided.

Each page should be saved as the id ('slug') of the page with '.md' suffix. eg "about.md". Use the npm package 'turndown' do convert from HTML to Markdown.