import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import {DesktopWidget, formatted, label} from './desktopWidget.js';

export const ClockWidget = GObject.registerClass(
class ClockWidget extends DesktopWidget {
  _init(settings) {
    super._init(settings, 'clock');
    this._timeLabel = null;
    this._dateLabel = null;
    this._width = null;
  }

  build() {
    // Empty format = that line is hidden.
    this._timeLabel = this._str('time-format')
      ? label('', this._text(this._int('time-size') / this._int('font-size'), ' font-weight: bold;')) : null;
    this._dateLabel = this._str('date-format') ? label('', this._text(1)) : null;
    for (const l of [this._timeLabel, this._dateLabel]) if (l) this.add_child(l);
    this.tick();
  }

  // Called every second: only the text changes, so labels are updated in place.
  tick() {
    const now = GLib.DateTime.new_now_local();
    if (this._timeLabel) this._timeLabel.text = formatted(now, this._str('time-format'));
    if (this._dateLabel) this._dateLabel.text = formatted(now, this._str('date-format'));
    // The width follows the digits; keep the widget where the position setting puts it.
    const width = this.get_preferred_width(-1)[1];
    if (width !== this._width) {
      this._width = width;
      this.place();
    }
  }
});
