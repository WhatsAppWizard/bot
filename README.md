# TypescriptStarter

A modern TypeScript starter project with ESLint, Nodemon, and TypeScript configured for an efficient development workflow. This template provides a solid foundation for building TypeScript applications with best practices in mind.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![ESLint](https://img.shields.io/badge/ESLint-4B32C3?style=for-the-badge&logo=eslint&logoColor=white)](https://eslint.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)

## 🚀 Features

- **TypeScript** support for enhanced code quality and developer experience
- **ESLint** configuration for consistent code style
- **Nodemon** integration for automatic server restarts during development
- **Streamlined build process** using `tsc`
- **Development-ready** environment with hot reloading

## 📁 Project Structure

```
gitnasr-typescriptstarter/
├── nodemon.json     # Nodemon configuration
├── package.json     # Dependencies and scripts
├── tsconfig.json    # TypeScript configuration
├── .eslintrc.js    # ESLint rules
└── src/
    └── index.ts    # Application entry point
```

## 🔧 Prerequisites

- **Node.js** (LTS version recommended)
- **npm** or **yarn**


## 📥 Getting Started

### Use This Template

1. Click the "Use this template" button at the top of this repository
2. Clone your new repository:
   ```bash
   git clone https://github.com/yourusername/your-repo-name.git
   cd your-repo-name
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Update the following files with your project details:
   - `package.json`: Update name, version, description, and author
   - This `README.md`: Add your project-specific documentation
   - `LICENSE`: Choose and add your preferred license



### Development Mode

Start the development server with hot reloading:
```bash
npm run dev
```

### Build

Compile the TypeScript code to JavaScript:
```bash
npm run build
```

### Linting

Run ESLint to check code quality:
```bash
npm run lint
```

## ⚙️ Configuration Files

### ESLint Configuration
`.eslintrc.js` contains ESLint rules for maintaining code quality. Customize the rules to match your team's coding standards.

### Nodemon Configuration
`nodemon.json` configures the development server:
```json
{
  "watch": ["src"],
  "ext": ".ts,.js",
  "exec": "ts-node ./src/index.ts"
}
```



### TypeScript Configuration
`tsconfig.json` includes compiler options:
- Target: ES2016
- Module System: CommonJS
- Output Directory: `build`

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is [MIT licensed](LICENSE) - see the [LICENSE](LICENSE) file for details.

## 🌟 Support

Give a ⭐️ if this project helped you!

---

Made with ❤️ by [gitnasr](@gitnasr)
