import React, { Component } from 'react';
import pdfjs from 'pdfjs-dist/build/pdf';
import { fabric } from 'fabric';
import axios from 'axios';

import './App.css';

pdfjs.GlobalWorkerOptions.workerSrc = '../../node_modules/pdfjs-dist/build/pdf.worker.js';

fabric.Object.prototype._renderStroke = function (ctx) {
  ctx.save();
  ctx.scale(1 / this.scaleX, 1 / this.scaleY);
  this._setLineDash(ctx, this.strokeDashArray, this._renderDashedStroke);
  ctx.stroke();
  ctx.restore();
};

const ZOOM_SCALE = .25;
const SELECTION_TOP_POSITION = 50;
const SELECTION_LEFT_POSITION = 50;
const SELECTION_WIDTH_SIZE = 250;
const SELECTION_HEIGHT_SIZE = 100;

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
      viewport: undefined,
      mp3: null,
    };

    this.bookPageLeft = React.createRef();
    this.bookPageRight = React.createRef();

    this.solutionPageLeft = React.createRef();
    this.solutionPageRight = React.createRef();
  }

  componentWillMount() {
    axios({
      method: 'get',
      url: 'https://pakket-p-public.s3.amazonaws.com/mp3/test.mp3',
      responseType: 'blob'
    })
      .then(response => {
        this.setState({ mp3: window.URL.createObjectURL(response.data) });
      })
      .catch(error => {
        console.log(error);
      });

    axios({
      method: 'get',
      url: 'https://pakket-p-public.s3.amazonaws.com/mp4/test.mp4',
      responseType: 'blob'
    })
      .then(response => {
        this.setState({ mp4: window.URL.createObjectURL(response.data) });
      })
      .catch(error => {
        console.log(error);
      });

    pdfjs.getDocument('https://pakket-p-public.s3.amazonaws.com/pdf/506764_6063_bl_spitze3_lr1.pdf')
      .then(pdfBl =>
        pdfjs.getDocument('https://pakket-p-public.s3.amazonaws.com/pdf/506764_6063_ol_spitze3_lr1.pdf')
          .then(pdfOl => {
            this.setState({ pdfBl, pdfOl, totalPages: pdfBl.numPages })
          })
      )
      .then(() => {
        this.drawAllCanvasses(this.state.pageNumber);
      })
  };

  renderPdfPage(pageNumber, background, canvas, pdf) {
    this.setState({ pageRendering: true });

    return pdf.getPage(pageNumber)
      .then(page => {
        // Scale
        const viewport = page.getViewport(this.state.scale);

        // Prepare canvas using PDF page dimensions
        const current = canvas.current;
        const canvasContext = current.getContext('2d');
        current.height = viewport.height;
        current.width = viewport.width;

        this.setState({ viewport });

        if (!this.state.selectionCanvas) {
          const selectionCanvas = new fabric.Canvas('selection-canvas');
          selectionCanvas.setHeight(viewport.height);
          selectionCanvas.setWidth(viewport.width);

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
        const { pageNumPending } = this.state;
        if (pageNumPending !== null) this.drawAllCanvasses(pageNumPending);

        this.setState({ pageRendering: false, pageNumPending: null });
      })
      .catch(e => console.log(e));
  }

  queueRenderPage(pageNumber) {
    this.setState(prevState => {
      let nextState = { pageNumber };

      if (prevState.pageRendering) {
        nextState.pageNumPending = pageNumber;
      } else {
        this.drawAllCanvasses(pageNumber);
      }

      return nextState;
    });
  }

  onPrevPage() {
    const { pageNumber } = this.state;
    if (pageNumber <= 2) return;

    const newPageNumber = pageNumber - 2;
    this.queueRenderPage(newPageNumber);
  }

  onNextPage() {
    const { pageNumber, totalPages } = this.state;
    if (pageNumber === totalPages) return;

    const newPageNumber = pageNumber + 2;
    this.queueRenderPage(newPageNumber);
  }

  onPageSwitch(e) {
    const { totalPages } = this.state;
    const pageNumber = +e.target.value;
    const regex = /^[0-9\b]+$/;

    if (!regex.test(pageNumber)) return;
    if (pageNumber > totalPages) return;
    if (pageNumber <= 0) return;
    if (pageNumber === totalPages) {
      this.queueRenderPage(pageNumber - 1);
      return;
    }

    this.queueRenderPage(pageNumber);
  }

  drawAllCanvasses(pageNumber) {
    this.renderPdfPage(pageNumber, 'rgb(255,255,255)', this.bookPageLeft, this.state.pdfBl);
    this.renderPdfPage(pageNumber + 1, 'rgb(255,255,255)', this.bookPageRight, this.state.pdfBl);

    if (this.state.showAnswers) this.drawAnswerCanvasses(pageNumber);
  }

  drawAnswerCanvasses(pageNumber) {
    this.renderPdfPage(pageNumber, 'rgba(0,0,0,0)', this.solutionPageLeft, this.state.pdfOl);
    this.renderPdfPage(pageNumber + 1, 'rgba(0,0,0,0)', this.solutionPageRight, this.state.pdfOl);
  }

  scaleSelections(scaleUp) {
    const { selectionCanvas } = this.state;

    if (selectionCanvas) {
      selectionCanvas
        .getObjects()
        .map(obj => {
          const mappedObj = Object.assign({}, obj);

          const widthDiff = Math.round(obj.width / ZOOM_SCALE)
          const heightDiff = Math.round(obj.height / ZOOM_SCALE)
          const topDiff = Math.round(obj.top / ZOOM_SCALE);
          const leftDiff = Math.round(obj.left / ZOOM_SCALE);

          if (scaleUp) {
            mappedObj.width += widthDiff;
            mappedObj.height += heightDiff;
            mappedObj.top += topDiff;
            mappedObj.left += leftDiff;
          } else {
            mappedObj.width -= widthDiff;
            mappedObj.height -= heightDiff;
            mappedObj.top -= topDiff;
            mappedObj.left -= leftDiff;
          }

          return mappedObj;
        });

      selectionCanvas.renderAll();
    }
  }

  onZoomIn() {
    this.setState(prevState => ({
      scale: prevState.scale + ZOOM_SCALE
    }), () => {
      this.drawAllCanvasses(this.state.pageNumber);
      this.scaleSelections(true);
    });
  }

  onZoomOut() {
    this.setState(prevState => ({
      scale: prevState.scale - ZOOM_SCALE
    }), () => {
      this.drawAllCanvasses(this.state.pageNumber);
      this.scaleSelections();
    });
  }

  onToggleAnswers(e) {
    const checked = e.target.checked;
    this.setState({ showAnswers: checked }, () => {
      if (checked) this.drawAnswerCanvasses(this.state.pageNumber);
    });
  }

  onAddSelection() {
    const { selectionCanvas, scale } = this.state;
    const options = {
      left: SELECTION_LEFT_POSITION * scale,
      top: SELECTION_TOP_POSITION * scale,
      width: SELECTION_WIDTH_SIZE * scale,
      height: SELECTION_HEIGHT_SIZE * scale,
      cornerSize: 10,
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
    return (
      <div>
        <button onClick={() => this.onPrevPage()}>previous</button>
        <input onChange={e => this.onPageSwitch(e)} type="text" />
        <button onClick={() => this.onNextPage()}>next</button>
        <button onClick={() => this.onZoomOut()}>zoom out</button>
        <button onClick={() => this.onZoomIn()}>zoom in</button>
        <button onClick={() => this.onAddSelection()}>add selection</button>
        <input onClick={e => this.onToggleAnswers(e)} type="checkbox" /> toggle answers
        {this.state.mp3 && <audio controls src={this.state.mp3} />}
        {this.state.mp4 && <video controls src={this.state.mp4} />}

        <div id="layer-container">
          <div className="page-container">
            <div className="canvas-wrapper">
              <div className="selection-container">
                <canvas id="selection-canvas" />
              </div>
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
