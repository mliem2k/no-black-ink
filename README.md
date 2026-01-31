# No Black Ink

A web-based tool that helps you convert documents to colored ink when you're out of black ink.

## Features

### Document Color Converter
- Convert black text and images to various colored inks (blue, brown, green, purple, red)
- **Color Modes**:
  - **Auto**: Only converts black elements to colored
  - **Grayscale**: Converts all grayscale to colored
  - **Full**: Converts everything to colored
- Supports PDFs and images
- Real-time preview with zoom and page navigation
- Batch processing for multiple files

### PDF Password Unlocker
- Remove passwords from password-protected PDFs
- Maintains original PDF quality
- All processing happens locally in your browser

## Tech Stack

- React 19 with TypeScript
- Vite
- Tailwind CSS
- Radix UI components
- PDF.js for PDF processing
- jsPDF for PDF generation

## Installation

```bash
pnpm install
```

## Usage

```bash
# Development
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Privacy

All file processing happens locally in your browser. No files are uploaded to any server.

## License

MIT
