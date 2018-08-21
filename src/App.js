import React, { Component } from 'react';
import pdfjs from 'pdfjs-dist/build/pdf';

import './App.css';
import pdfPath from './assets/bl.pdf';

pdfjs.GlobalWorkerOptions.workerSrc = '../../node_modules/pdfjs-dist/build/pdf.worker.js';

class App extends Component {
  componentDidMount() {
    pdfjs.getDocument(pdfPath)
      .then((pdf) => {
        const pageNumber = 2;
        pdf.getPage(pageNumber)
          .then(page => {
            console.log('Page loaded');

            const scale = 1;
            const viewport = page.getViewport(scale);

            // Prepare canvas using PDF page dimensions
            const canvas = document.getElementById('the-canvas');
            var context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            // Render PDF page into canvas context
            var renderContext = {
              canvasContext: context,
              viewport: viewport
            };

            var renderTask = page.render(renderContext);
            renderTask.then(() => {
              console.log('Page rendered');
            });
          });
      }, reason => {
        console.error(reason);
      });
  };

  render() {
    return (
      <div className="App">
        <canvas id="the-canvas"></canvas>
      </div>
    );
  }
}

export default App;
