import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {DesktopWidget, formatted, label} from './desktopWidget.js';

// Names of the seven weekdays starting at `weekStart` (0 = Sunday).
function weekdayNames(weekStart, format) {
  const names = [];
  for (let i = 0; i < 7; i++) {
    // 2024-01-07 is a Sunday.
    const d = GLib.DateTime.new_local(2024, 1, 7 + ((weekStart + i) % 7), 12, 0, 0);
    names.push(d.format(format) ?? format);
  }
  return names;
}

export const CalendarWidget = GObject.registerClass(
class CalendarWidget extends DesktopWidget {
  _init(settings) {
    super._init(settings, 'cal');
    this._day = null;
  }

  build() {
    const now = GLib.DateTime.new_now_local();
    this._day = now.get_day_of_year();
    const style = this._str('style');
    if (style === 'week') this._buildWeek(now);
    else if (style === 'minimal') this._buildMinimal(now);
    else this._buildGrid(now);
  }

  refreshIfNewDay() {
    if (GLib.DateTime.new_now_local().get_day_of_year() !== this._day) this.rebuild();
  }

  _dayCell(text, today, scale = 1, header = false) {
    const size = this._int('font-size');
    const width = Math.round(size * 2.4);
    const height = header ? Math.round(size * 1.6) : width;
    const accent = this._str('accent-color').replace(/["';{}\\<>]/g, '');
    const bg = today ? ` background-color: ${accent}; border-radius: ${width}px;` : '';
    // The Bin gives the cell its size and background; the label sits centred inside it.
    const cell = new St.Bin({style: `${bg} width: ${width}px; height: ${height}px;`, x_align: Clutter.ActorAlign.FILL, y_align: Clutter.ActorAlign.FILL});
    cell.set_child(label(text, this._text(scale)));
    return cell;
  }

  _addLine(now, name, scale, extra = '') {
    const text = formatted(now, this._str(name));
    if (text !== null) this.add_child(label(text, this._text(scale, extra)));
  }

  _buildGrid(now) {
    const ws = this._int('week-start');
    this._addLine(now, 'grid-title-format', 1.25, ' font-weight: bold;');

    const head = new St.BoxLayout();
    for (const name of weekdayNames(ws, this._str('weekday-format'))) head.add_child(this._dayCell(name, false, 0.8, true));
    this.add_child(head);

    const first = GLib.DateTime.new_local(now.get_year(), now.get_month(), 1, 12, 0, 0);
    const offset = ((first.get_day_of_week() % 7) - ws + 7) % 7;
    const total = GLib.Date.get_days_in_month(now.get_month(), now.get_year());
    let day = 1 - offset;
    while (day <= total) {
      const row = new St.BoxLayout();
      for (let i = 0; i < 7; i++, day++) {
        const inMonth = day >= 1 && day <= total;
        row.add_child(this._dayCell(inMonth ? `${day}` : '', inMonth && day === now.get_day_of_month()));
      }
      this.add_child(row);
    }
  }

  _buildWeek(now) {
    const ws = this._int('week-start');
    this._addLine(now, 'week-title-format', 1.1, ' font-weight: bold;');

    const back = ((now.get_day_of_week() % 7) - ws + 7) % 7;
    const start = now.add_days(-back);
    const names = weekdayNames(ws, this._str('weekday-format'));
    const row = new St.BoxLayout();
    for (let i = 0; i < 7; i++) {
      const d = start.add_days(i);
      const col = new St.BoxLayout({vertical: true});
      col.add_child(this._dayCell(names[i], false, 0.8, true));
      col.add_child(this._dayCell(`${d.get_day_of_month()}`, d.get_day_of_year() === this._day && d.get_year() === now.get_year()));
      row.add_child(col);
    }
    this.add_child(row);
  }

  _buildMinimal(now) {
    this._addLine(now, 'minimal-day-format', 4.5, ' font-weight: bold;');
    this._addLine(now, 'minimal-weekday-format', 1.3);
    this._addLine(now, 'minimal-month-format', 1);
  }
});
