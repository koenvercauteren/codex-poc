import React, { Component } from 'react';
import pdfjs from 'pdfjs-dist/build/pdf';
import { fabric } from 'fabric';

import blPath from './assets/bl.pdf';
import olPath from './assets/ol.pdf';

import './App.css';

pdfjs.GlobalWorkerOptions.workerSrc = '../../node_modules/pdfjs-dist/build/pdf.worker.js';

fabric.Object.prototype._renderStroke = function (ctx) {
  ctx.save();
  ctx.scale(1 / this.scaleX, 1 / this.scaleY);
  this._setLineDash(ctx, this.strokeDashArray, this._renderDashedStroke);
  ctx.stroke();
  ctx.restore();
};

class App extends Component {
  constructor(props) {
    super(props);

    this.state = {
      totalPages: 0,
      pageNumber: 1,
      scale: 1,
      pageRendering: false,
      pageNumPending: null,
      pdfBl: null,
      pdflOl: null,
      showAnswers: false,
      selectionCanvas: undefined,
    };

    this.bookPageLeft = React.createRef();
    this.bookPageRight = React.createRef();

    this.solutionPageLeft = React.createRef();
    this.solutionPageRight = React.createRef();
  }

  componentWillMount() {
    pdfjs.getDocument(blPath)
      .then(pdfBl =>
        pdfjs.getDocument(olPath)
          .then(pdfOl => {
            this.setState({ pdfBl, pdfOl, totalPages: pdfBl.numPages })
          })
      )
      .then(() => {
        this.drawAllCanvasses(this.state.pageNumber);
      });
  };

  renderPdfPage(pageNumber, background, canvas, pdf) {
    this.setState({ pageRendering: true });

    pdf.getPage(pageNumber)
      .then(page => {
        // Scale
        const viewport = page.getViewport(this.state.scale);

        // Prepare canvas using PDF page dimensions
        const current = canvas.current;
        const canvasContext = current.getContext('2d');
        current.height = viewport.height;
        current.width = viewport.width;

        if (!this.state.selectionCanvas) {
          const selectionCanvas = new fabric.Canvas('selection-canvas');
          selectionCanvas.setHeight(viewport.height);
          selectionCanvas.setWidth(viewport.width * 2);

          this.setState({ selectionCanvas });
        }

        // Render PDF page into canvas context
        const renderContext = {
          canvasContext,
          viewport,
          background,
        };

        return page.render(renderContext);
      })
      .then(() => {
        this.setState(prevState => {
          const { pageNumPending, pageNumber } = prevState;
          let nextState = { pageRendering: false };

          if (pageNumPending !== null && pageNumPending !== pageNumber) {
            nextState.pageNumPending = null;
            this.drawAllCanvasses(pageNumPending);
          }

          return nextState;
        });
      })
  }

  queueRenderPage(pageNumber) {
    this.setState(prevState => {
      let nextState = { pageNumber };

      if (prevState.pageRendering) nextState.pageNumPending = pageNumber;
      else this.drawAllCanvasses(pageNumber);

      return nextState;
    });
  }

  onPrevPage() {
    const { pageNumber } = this.state;
    if (pageNumber <= 1) return;

    const newPageNumber = pageNumber - 1;
    this.queueRenderPage(newPageNumber);
  }

  onNextPage() {
    const { pageNumber, totalPages } = this.state;
    if (pageNumber >= totalPages) return;

    const newPageNumber = pageNumber + 1;
    this.queueRenderPage(newPageNumber);
  }

  onPageSwitch(e) {
    const { totalPages } = this.state;
    const pageNumber = e.target.value;
    const regex = /^[0-9\b]+$/;

    if (!regex.test(pageNumber)) return;
    if (pageNumber >= totalPages) return;
    if (pageNumber <= 0) return;

    this.queueRenderPage(+pageNumber);
  }

  drawAllCanvasses(pageNumber) {
    this.renderPdfPage(pageNumber, 'rgb(255,255,255)', this.bookPageLeft, this.state.pdfBl);
    this.renderPdfPage(pageNumber + 1, 'rgb(255,255,255)', this.bookPageRight, this.state.pdfBl);

    const { selectionCanvas } = this.state;
    if (selectionCanvas) {
      selectionCanvas
        .getObjects()
        .map(obj => {
          obj.scaleX = this.state.scale;
          obj.scaleY = this.state.scale;
          console.log({ obj });
          return obj;
        });

      selectionCanvas.renderAll();
    }

    if (this.state.showAnswers) this.drawAnswerCanvasses(pageNumber);
  }

  drawAnswerCanvasses(pageNumber) {
    this.renderPdfPage(pageNumber, 'rgba(0,0,0,0)', this.solutionPageLeft, this.state.pdfOl);
    this.renderPdfPage(pageNumber + 1, 'rgba(0,0,0,0)', this.solutionPageRight, this.state.pdfOl);
  }

  onZoomIn() {
    this.setState(prevState => ({
      scale: prevState.scale + .25
    }), () => {
      this.drawAllCanvasses(this.state.pageNumber);
    });
  }

  onZoomOut() {
    this.setState(prevState => ({
      scale: prevState.scale - .25
    }), () => {
      this.drawAllCanvasses(this.state.pageNumber);
    });
  }

  onToggleAnswers(e) {
    const checked = e.target.checked;
    this.setState({ showAnswers: checked }, () => {
      if (checked) this.drawAnswerCanvasses(this.state.pageNumber);
    });
  }

  onAddSelection() {
    const { selectionCanvas } = this.state;
    const options = {
      left: 50,
      top: 50,
      width: 250,
      height: 100,
      cornerSize: 6,
      stroke: '#FF9900',
      strokeWidth: 2,
      strokeDashArray: [5],
      fill: 'transparent',
      hasRotatingPoint: false,
    };

    const selection = new fabric.Rect(options);
    selectionCanvas.add(selection);

    const activeObjectPosition = selectionCanvas.getObjects().length - 1;
    selectionCanvas.setActiveObject(selectionCanvas.item(activeObjectPosition));
  }

  render() {
    console.log('RENDER APP COMPONENT');
    return (
      <div>
        <button onClick={() => this.onPrevPage()}>previous</button>
        <input onChange={e => this.onPageSwitch(e)} type="text" />
        <button onClick={() => this.onNextPage()}>next</button>
        <button onClick={() => this.onZoomOut()}>zoom out</button>
        <button onClick={() => this.onZoomIn()}>zoom in</button>
        <button onClick={() => this.onAddSelection()}>add selection</button>
        <input onClick={e => this.onToggleAnswers(e)} type="checkbox" /> toggle answers

        <div id="layer-container">
          <div className="page-container">
            <div className="selection-container">
              <canvas id="selection-canvas" />
            </div>

            <div className="canvas-wrapper">
              <canvas ref={this.bookPageLeft} />
            </div>

            <div className="canvas-wrapper">
              <canvas ref={this.bookPageRight} />
            </div>
          </div>

          {this.state.showAnswers &&
            <div className="page-container">
              <canvas ref={this.solutionPageLeft} />
              <canvas ref={this.solutionPageRight} />
            </div>
          }
        </div>
      </div >
    );
  }
}

export default App;
