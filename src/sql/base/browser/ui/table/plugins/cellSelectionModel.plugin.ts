// Drag select selection model gist taken from https://gist.github.com/skoon/5312536
// heavily modified

import { mixin } from 'vs/base/common/objects';
import { isUndefinedOrNull } from 'vs/base/common/types';

import { CellRangeSelector, ICellRangeSelector } from 'sql/base/browser/ui/table/plugins/cellRangeSelector';

export interface ICellSelectionModelOptions {
	cellRangeSelector?: any;
	selectActiveCell?: boolean;
}

const defaults: ICellSelectionModelOptions = {
	selectActiveCell: true
};

export class CellSelectionModel<T> implements Slick.SelectionModel<T, Array<Slick.Range>> {
	private grid: Slick.Grid<T>;
	private selector: ICellRangeSelector<T>;
	private ranges: Array<Slick.Range> = [];
	private _handler = new Slick.EventHandler();

	public onSelectedRangesChanged = new Slick.Event<Array<Slick.Range>>();

	constructor(private options: ICellSelectionModelOptions = defaults) {
		this.options = mixin(this.options, defaults, false);

		if (this.options.cellRangeSelector) {
			this.selector = this.options.cellRangeSelector;
		} else {
			// this is added by the noderequires above
			this.selector = new CellRangeSelector({ selectionCss: { 'border': '2px dashed grey' } });
		}
	}

	public init(grid: Slick.Grid<T>) {
		this.grid = grid;
		this._handler.subscribe(this.grid.onActiveCellChanged, (e: Event, args: Slick.OnActiveCellChangedEventArgs<T>) => this.handleActiveCellChange(e, args));
		this._handler.subscribe(this.grid.onKeyDown, (e: KeyboardEvent) => this.handleKeyDown(e));
		this._handler.subscribe(this.grid.onClick, (e: MouseEvent, args: Slick.OnClickEventArgs<T>) => this.handleCtrlClick(e, args));
		this._handler.subscribe(this.grid.onHeaderClick, (e: MouseEvent, args: Slick.OnHeaderClickEventArgs<T>) => this.handleHeaderClick(e, args));
		this.grid.registerPlugin(this.selector);
		this._handler.subscribe(this.selector.onCellRangeSelected, (e: Event, range: Slick.Range) => this.handleCellRangeSelected(e, range));
		this._handler.subscribe(this.selector.onBeforeCellRangeSelected, (e: Event, cell: Slick.Cell) => this.handleBeforeCellRangeSelected(e, cell));
	}

	public destroy() {
		this._handler.unsubscribeAll();
		this.grid.unregisterPlugin(this.selector);
	}

	private removeInvalidRanges(ranges: Array<Slick.Range>): Array<Slick.Range> {
		let result: Array<Slick.Range> = [];

		for (let i = 0; i < ranges.length; i++) {
			let r = ranges[i];
			if (this.grid.canCellBeSelected(r.fromRow, r.fromCell) && this.grid.canCellBeSelected(r.toRow, r.toCell)) {
				result.push(r);
			} else if (this.grid.canCellBeSelected(r.fromRow, r.fromCell + 1) && this.grid.canCellBeSelected(r.toRow, r.toCell)) {
				// account for number row
				result.push(new Slick.Range(r.fromRow, r.fromCell + 1, r.toRow, r.toCell));
			}
		}

		return result;
	}

	public setSelectedRanges(ranges: Array<Slick.Range>): void {
		// simple check for: empty selection didn't change, prevent firing onSelectedRangesChanged
		if ((!this.ranges || this.ranges.length === 0) && (!ranges || ranges.length === 0)) {
			return;
		}

		this.ranges = this.removeInvalidRanges(ranges);
		this.onSelectedRangesChanged.notify(this.ranges);
	}

	public getSelectedRanges() {
		return this.ranges;
	}

	private handleBeforeCellRangeSelected(e: Event, args: Slick.Cell) {
		if (this.grid.getEditorLock().isActive()) {
			e.stopPropagation();
			return false;
		}
		return true;
	}

	private handleCellRangeSelected(e: Event, range: Slick.Range) {
		this.grid.setActiveCell(range.fromRow, range.fromCell, false, false, true);
		this.setSelectedRanges([range]);
	}

	private handleActiveCellChange(e: Event, args: Slick.OnActiveCellChangedEventArgs<T>) {
		if (this.options.selectActiveCell && !isUndefinedOrNull(args.row) && !isUndefinedOrNull(args.cell)) {
			this.setSelectedRanges([new Slick.Range(args.row, args.cell)]);
		} else if (!this.options.selectActiveCell) {
			// clear the previous selection once the cell changes
			this.setSelectedRanges([]);
		}
	}

	private handleHeaderClick(e: MouseEvent, args: Slick.OnHeaderClickEventArgs<T>) {
		if (!isUndefinedOrNull(args.column)) {
			let columnIndex = this.grid.getColumnIndex(args.column.id!);
			if (this.grid.canCellBeSelected(0, columnIndex)) {
				let ranges: Array<Slick.Range>;
				if (e.shiftKey || e.ctrlKey) {
					ranges = this.getSelectedRanges();
					ranges.push(new Slick.Range(0, columnIndex, this.grid.getDataLength() - 1, columnIndex));
				} else {
					ranges = [new Slick.Range(0, columnIndex, this.grid.getDataLength() - 1, columnIndex)];
				}
				this.grid.setActiveCell(0, columnIndex);
				this.setSelectedRanges(ranges);
			}
		}
	}

	private handleCtrlClick(e: MouseEvent, args: Slick.OnClickEventArgs<T>) {
		if (!e.ctrlKey) {
			return;
		}
		let ranges: Array<Slick.Range>;

		ranges = this.getSelectedRanges();

		ranges.push(new Slick.Range(args.row, args.cell));
		this.grid.setActiveCell(args.row, args.cell);
		this.setSelectedRanges(ranges);
		e.preventDefault();
		e.stopImmediatePropagation();
	}

	private handleKeyDown(e: KeyboardEvent) {
		/***
		 * Кey codes
		 * 37 left
		 * 38 up
		 * 39 right
		 * 40 down
		 */
		let active = this.grid.getActiveCell();
		let metaKey = e.ctrlKey || e.metaKey;

		if (active && e.shiftKey && !metaKey && !e.altKey &&
			(e.which === 37 || e.which === 39 || e.which === 38 || e.which === 40)) {
			let ranges = this.getSelectedRanges(), last: Slick.Range;

			ranges = this.getSelectedRanges();
			if (!ranges.length) {
				ranges.push(new Slick.Range(active.row, active.cell));
			}

			// keyboard can work with last range only
			last = ranges.pop()!; // this is guarenteed since if ranges is empty we add one

			// can't handle selection out of active cell
			if (!last.contains(active.row, active.cell)) {
				last = new Slick.Range(active.row, active.cell);
			}

			let dRow = last.toRow - last.fromRow,
				dCell = last.toCell - last.fromCell,
				// walking direction
				dirRow = active.row === last.fromRow ? 1 : -1,
				dirCell = active.cell === last.fromCell ? 1 : -1;

			if (e.which === 37) {
				dCell -= dirCell;
			} else if (e.which === 39) {
				dCell += dirCell;
			} else if (e.which === 38) {
				dRow -= dirRow;
			} else if (e.which === 40) {
				dRow += dirRow;
			}

			// define new selection range
			let new_last = new Slick.Range(active.row, active.cell, active.row + dirRow * dRow, active.cell + dirCell * dCell);
			if (this.removeInvalidRanges([new_last]).length) {
				ranges.push(new_last);
				let viewRow = dirRow > 0 ? new_last.toRow : new_last.fromRow;
				let viewCell = dirCell > 0 ? new_last.toCell : new_last.fromCell;
				this.grid.scrollRowIntoView(viewRow, false);
				this.grid.scrollCellIntoView(viewRow, viewCell, false);
			} else {
				ranges.push(last);
			}

			this.setSelectedRanges(ranges);

			e.preventDefault();
			e.stopPropagation();
		}
	}
}
