import { Widget } from '@lumino/widgets';

/**
 * A class for all ViewerWidgets, allows tracking of if they're open or not.
 */
export class ViewerWidget extends Widget {
    isOpen:boolean

  constructor() {
    super();
    this.isOpen = false;
    }

    //We can track our ViewerWidget events by subclassing Lumino Widgets

  /**
   * Handle a `after-attach` message.
   */
  protected onAfterAttach(): void {
    this.isOpen = true;
  }

  /**
   * Handle a `after-detach` message.
   */
  protected onAfterDetach(): void {
    this.isOpen = false;
  }
}