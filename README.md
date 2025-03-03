# SQLite Web Client

A web-based SQLite database client that allows you to manage your SQLite databases through a web interface.

## Features

- Web-based interface for SQLite database management
- Support for executing SQL queries
- Import data from CSV and Excel files
- Export query results
- Simple and intuitive user interface

## Installation

```bash
npm install sqlite-web-client
```

## Usage

```javascript
const { startServer } = require('sqlite-web-client');

// Start the server with default settings
startServer(3000, 'path/to/your/database.db');

// The web interface will be available at http://localhost:3000
```

```shell
npx sqlite-web-client start
```

## API

### startServer(port, dbPath)

Starts the SQLite Web Client server.

- `port` (number): The port number to run the server on (default: 3000)
- `dbPath` (string): Path to the SQLite database file

## Development

```bash
# Clone the repository
git clone https://github.com/Rainmen-xia/sqlite-web-client.git

# Install dependencies
cd sqlite-web-client
npm install

# Start development server
npm run dev
```

## License

MIT

## Author

rainmenxia 