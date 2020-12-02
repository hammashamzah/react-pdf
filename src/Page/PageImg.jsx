import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';

import PageContext from '../PageContext';

import {
  errorOnDev,
  getPixelRatio,
  isCancelException,
  makePageCallback,
} from '../shared/utils';

import { isPage, isRotate } from '../shared/propTypes';

export class PageImgInternal extends PureComponent {
	state = {
    imageDataURL: null,
    loadingState: 0, /* IDLE */
    isError: false,
	}
  componentDidMount() {
    this.drawPageOnCanvas();
  }

  componentDidUpdate(prevProps) {
    const { page, renderInteractiveForms } = this.props;
    if (renderInteractiveForms !== prevProps.renderInteractiveForms) {
      // Ensures the canvas will be re-rendered from scratch. Otherwise all form data will stay.
      page.cleanup();
      this.drawPageOnCanvas();
    }
  }

  /**
 * Called when a page is rendered successfully.
 */
  onRenderSuccess = () => {
    this.renderer = null;

    const { onRenderSuccess, page, scale } = this.props;

    this.setState({
      loadingState : 2 /* SUCCESS */
    })

    if (onRenderSuccess) onRenderSuccess(makePageCallback(page, scale));
  }

  componentWillUnmount() {
    this.cancelRenderingTask();

    /**
     * Zeroing the width and height cause most browsers to release graphics
     * resources immediately, which can greatly reduce memory consumption.
     */

    //  TODO: move this to the rendering process
    if (this.canvas) {
      this.canvas.width = 0;
      this.canvas.height = 0;
      this.canvas = null;
    }
  }

  cancelRenderingTask() {
    /* eslint-disable no-underscore-dangle */
    if (this.renderer && this.renderer._internalRenderTask.running) {
      this.renderer._internalRenderTask.cancel();
    }
    /* eslint-enable no-underscore-dangle */
  }



  /**
   * Called when a page fails to render.
   */
  onRenderError = (error) => {
    if (isCancelException(error)) {
      return;
    }

    errorOnDev(error);

    const { onRenderError } = this.props;

    this.setState({
      loadingState: 3 /* ERROR */
    });

    if (onRenderError) onRenderError(error);
  }

  get renderViewport() {
    const { page, rotate, scale } = this.props;

    const pixelRatio = getPixelRatio();

    return page.getViewport({ scale: scale * pixelRatio, rotation: rotate });
  }

  get viewport() {
    const { page, rotate, scale } = this.props;

    return page.getViewport({ scale, rotation: rotate });
  }

  convertCanvasToImage = () => {
    if (!this.canvas) {
      return;
    }

    this.setState({
      imageDataURL: this.canvas.toDataURL()
    });

    // Zeroing the width and height causes Firefox to release graphics
    // resources immediately, which can greatly reduce memory consumption.
    this.canvas.width = 0;
    this.canvas.height = 0;
    delete this.canvas;
  }

  drawPageOnCanvas = () => {

    this.setState({
      loadingState: 1 /* LOADING */
    })
    // const { canvas: canvas } = this;
    const canvas = document.createElement("canvas");
    // Keep the no-thumbnail outline visible, i.e. `data-loaded === false`,
    // until rendering/image conversion is complete, to avoid display issues.
    this.canvas = canvas;

    if (!canvas) {
      return null;
    }

    const { renderViewport, viewport } = this;
    const { page, renderInteractiveForms } = this.props;

    canvas.width = renderViewport.width;
    canvas.height = renderViewport.height;

    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    const renderContext = {
      get canvasContext() {
        return canvas.getContext('2d', {alpha: false});
      },
      viewport: renderViewport,
      // renderInteractiveForms,
    };

    // If another render is in progress, let's cancel it
    // this.cancelRenderingTask();

    this.renderer = page.render(renderContext);

    const resultPromise = this.renderer.promise
      .then(this.onRenderSuccess())
      .catch(this.onRenderError);

    resultPromise.finally(() => {
      page.cleanup();
      this.convertCanvasToImage();
    });

    return resultPromise;
    
  }

  render() {
    const { width, height } = this.viewport;
    const { imageDataURL, loadingState } = this.state;
    switch (loadingState) {
      case 2: /* SUCCESS */
        return (
          <img
            src={imageDataURL}
            className="react-pdf__Page__img"
            style={{
              display: 'block',
              userSelect: 'none',
              width,
              height
            }}
          />
        )
      case 0: /* IDLE */
      case 1: /* LOADING */
      case 3: /* ERROR */
      default:
        return (
          <div
            className="react-pdf__Page__not__img"
            style={{
              display: 'block',
              userSelect: 'none',
              width,
              height
            }}
          />
        )
    }
  }
}

PageImgInternal.propTypes = {
  onRenderError: PropTypes.func,
  onRenderSuccess: PropTypes.func,
  page: isPage.isRequired,
  renderInteractiveForms: PropTypes.bool,
  rotate: isRotate,
  scale: PropTypes.number,
};

export default function PageImg(props) {
  return (
    <PageContext.Consumer>
      {(context) => <PageImgInternal {...context} {...props} />}
    </PageContext.Consumer>
  );
}
