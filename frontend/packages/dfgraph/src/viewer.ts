import { Widget } from '@lumino/widgets';

/**
 * A class for all ViewerWidgets, allows tracking of if they're open or not.
 */
export class ViewerWidget extends Widget {
    is_open:boolean

  constructor() {
    super();
    this.is_open = false;
    }

    //We can track our ViewerWidget events by subclassing Lumino Widgets

  /**
   * Handle a `after-attach` message.
   */
  protected onAfterAttach(): void {
    this.is_open = true;
  }

  /**
   * Handle a `after-detach` message.
   */
  protected onAfterDetach(): void {
    this.is_open = false;
  }
}