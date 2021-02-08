/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./button';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import { Color } from 'vs/base/common/color';
import { mixin } from 'vs/base/common/objects';
import { Event as BaseEvent, Emitter } from 'vs/base/common/event';
import { Disposable } from 'vs/base/common/lifecycle';
import { Gesture, EventType as TouchEventType } from 'vs/base/browser/touch';
import { renderCodicons } from 'vs/base/browser/codicons';
import { addDisposableListener, IFocusTracker, EventType, EventHelper, trackFocus, reset, removeTabIndexAndUpdateFocus } from 'vs/base/browser/dom';

export interface IButtonOptions extends IButtonStyles {
	readonly title?: boolean | string;
	readonly supportCodicons?: boolean;
	readonly secondary?: boolean;
}

export interface IButtonStyles {
	buttonBackground?: Color;
	buttonHoverBackground?: Color;
	buttonForeground?: Color;
	buttonSecondaryBackground?: Color;
	buttonSecondaryHoverBackground?: Color;
	buttonSecondaryForeground?: Color;
	buttonBorder?: Color;
	// {{SQL CARBON EDIT}}
	buttonSecondaryBorder?: Color;
	buttonDisabledBackground?: Color;
	buttonDisabledForeground?: Color;
	buttonDisabledBorder?: Color;
}

const defaultOptions: IButtonStyles = {
	buttonBackground: Color.fromHex('#0E639C'),
	buttonHoverBackground: Color.fromHex('#006BB3'),
	buttonForeground: Color.white
};

export class Button extends Disposable {

	private _element: HTMLElement;
	private options: IButtonOptions;

	private buttonBackground: Color | undefined;
	private buttonHoverBackground: Color | undefined;
	private buttonForeground: Color | undefined;
	private buttonSecondaryBackground: Color | undefined;
	private buttonSecondaryHoverBackground: Color | undefined;
	private buttonSecondaryForeground: Color | undefined;
	private buttonBorder: Color | undefined;
	// {{SQL CARBON EDIT}}
	private buttonSecondaryBorder: Color | undefined;
	private buttonDisabledBackground: Color | undefined;
	private buttonDisabledForeground: Color | undefined;
	private buttonDisabledBorder: Color | undefined;
	private hasIcon: boolean = false;
	// {{SQL CARBON EDIT}} - END

	private _onDidClick = this._register(new Emitter<Event>());
	get onDidClick(): BaseEvent<Event> { return this._onDidClick.event; }

	private focusTracker: IFocusTracker;

	constructor(container: HTMLElement, options?: IButtonOptions) {
		super();

		this.options = options || Object.create(null);
		mixin(this.options, defaultOptions, false);

		this.buttonForeground = this.options.buttonForeground;
		this.buttonBackground = this.options.buttonBackground;
		this.buttonHoverBackground = this.options.buttonHoverBackground;

		this.buttonSecondaryForeground = this.options.buttonSecondaryForeground;
		this.buttonSecondaryBackground = this.options.buttonSecondaryBackground;
		this.buttonSecondaryHoverBackground = this.options.buttonSecondaryHoverBackground;

		this.buttonBorder = this.options.buttonBorder;
		// {{SQL CARBON EDIT}}
		this.buttonSecondaryBorder = this.options.buttonSecondaryBorder;
		this.buttonDisabledBackground = this.options.buttonDisabledBackground;
		this.buttonDisabledForeground = this.options.buttonDisabledForeground;
		this.buttonDisabledBorder = this.options.buttonDisabledBorder;


		this._element = document.createElement('a');
		this._element.classList.add('monaco-button');
		this._element.tabIndex = 0;
		this._element.setAttribute('role', 'button');

		container.appendChild(this._element);

		this._register(Gesture.addTarget(this._element));

		[EventType.CLICK, TouchEventType.Tap].forEach(eventType => {
			this._register(addDisposableListener(this._element, eventType, e => {
				if (!this.enabled) {
					EventHelper.stop(e);
					return;
				}

				this._onDidClick.fire(e);
			}));
		});

		this._register(addDisposableListener(this._element, EventType.KEY_DOWN, e => {
			const event = new StandardKeyboardEvent(e);
			let eventHandled = false;
			if (this.enabled && (event.equals(KeyCode.Enter) || event.equals(KeyCode.Space))) {
				this._onDidClick.fire(e);
				eventHandled = true;
			} else if (event.equals(KeyCode.Escape)) {
				this._element.blur();
				eventHandled = true;
			}

			if (eventHandled) {
				EventHelper.stop(event, true);
			}
		}));

		this._register(addDisposableListener(this._element, EventType.MOUSE_OVER, e => {
			if (!this._element.classList.contains('disabled')) {
				this.setHoverBackground();
			}
		}));

		this._register(addDisposableListener(this._element, EventType.MOUSE_OUT, e => {
			this.applyStyles(); // restore standard styles
		}));

		// Also set hover background when button is focused for feedback
		this.focusTracker = this._register(trackFocus(this._element));
		this._register(this.focusTracker.onDidFocus(() => this.setHoverBackground()));
		this._register(this.focusTracker.onDidBlur(() => this.applyStyles())); // restore standard styles

		this.applyStyles();
	}

	private setHoverBackground(): void {
		// {{SQL CARBON EDIT}} - skip if this is an icon button
		if (this.hasIcon) {
			return;
		}
		let hoverBackground;
		if (this.options.secondary) {
			hoverBackground = this.buttonSecondaryHoverBackground ? this.buttonSecondaryHoverBackground.toString() : null;
		} else {
			hoverBackground = this.buttonHoverBackground ? this.buttonHoverBackground.toString() : null;
		}
		if (hoverBackground) {
			this._element.style.backgroundColor = hoverBackground;
		}
	}

	style(styles: IButtonStyles): void {
		this.buttonForeground = styles.buttonForeground;
		this.buttonBackground = styles.buttonBackground;
		this.buttonHoverBackground = styles.buttonHoverBackground;
		this.buttonSecondaryForeground = styles.buttonSecondaryForeground;
		this.buttonSecondaryBackground = styles.buttonSecondaryBackground;
		this.buttonSecondaryHoverBackground = styles.buttonSecondaryHoverBackground;
		this.buttonBorder = styles.buttonBorder;

		this.buttonSecondaryBorder = styles.buttonSecondaryBorder;
		this.buttonDisabledBackground = styles.buttonDisabledBackground;
		this.buttonDisabledForeground = styles.buttonDisabledForeground;
		this.buttonDisabledBorder = styles.buttonDisabledBorder;

		this.applyStyles();
	}

	/**
	// {{SQL CARBON EDIT}} -- removed 'private' access modifier @todo anthonydresser 4/12/19 things needs investigation whether we need this
	applyStyles(): void {
		if (this._element) {
			let background, foreground;
			if (this.options.secondary) {
				foreground = this.buttonSecondaryForeground ? this.buttonSecondaryForeground.toString() : '';
				background = this.buttonSecondaryBackground ? this.buttonSecondaryBackground.toString() : '';
			} else {
				foreground = this.buttonForeground ? this.buttonForeground.toString() : '';
				background = this.buttonBackground ? this.buttonBackground.toString() : '';
			}

			const border = this.buttonBorder ? this.buttonBorder.toString() : '';

			this._element.style.color = foreground;
			this._element.style.backgroundColor = background;

			this._element.style.borderWidth = border ? '1px' : '';
			this._element.style.borderStyle = border ? 'solid' : '';
			this._element.style.borderColor = border;
		}
	}
	*/

	// {{SQL CARBON EDIT}} - custom applyStyles
	applyStyles(): void {
		if (this._element) {
			let background, foreground, border, fontWeight, fontSize;
			if (this.hasIcon) {
				background = border = 'transparent';
				foreground = this.buttonSecondaryForeground;
				fontWeight = fontSize = 'inherit';
			} else {
				if (this.enabled) {
					if (this.options.secondary) {
						foreground = this.buttonSecondaryForeground ? this.buttonSecondaryForeground.toString() : '';
						background = this.buttonSecondaryBackground ? this.buttonSecondaryBackground.toString() : '';
						border = this.buttonSecondaryBorder ? this.buttonSecondaryBorder.toString() : '';
					} else {
						foreground = this.buttonForeground ? this.buttonForeground.toString() : '';
						background = this.buttonBackground ? this.buttonBackground.toString() : '';
						border = this.buttonBorder ? this.buttonBorder.toString() : '';
					}
				}
				else {
					foreground = this.buttonDisabledForeground;
					background = this.buttonDisabledBackground;
					border = this.buttonDisabledBorder;
				}
				fontWeight = '600';
				fontSize = '12px';
			}

			this._element.style.color = foreground;
			this._element.style.backgroundColor = background;
			this._element.style.borderWidth = border ? '1px' : '';
			this._element.style.borderStyle = border ? 'solid' : '';
			this._element.style.borderColor = border;
			this._element.style.opacity = this.hasIcon ? '' : '1';
			this._element.style.fontWeight = fontWeight;
			this._element.style.fontSize = fontSize;
			this._element.style.borderRadius = '2px';
		}
	}
	// {{SQL CARBON EDIT}} - end custom applyStyles

	get element(): HTMLElement {
		return this._element;
	}

	set label(value: string) {
		this._element.classList.add('monaco-text-button');
		if (this.options.supportCodicons) {
			reset(this._element, ...renderCodicons(value));
		} else {
			this._element.textContent = value;
		}
		this._element.setAttribute('aria-label', value); // {{SQL CARBON EDIT}}
		if (typeof this.options.title === 'string') {
			this._element.title = this.options.title;
		} else if (this.options.title) {
			this._element.title = value;
		}
	}

	// {{SQL CARBON EDIT}}
	set icon(iconClassName: string) {
		this.hasIcon = iconClassName !== '';
		this._element.classList.add(...iconClassName.split(' '));
		this.applyStyles();
	}

	set enabled(value: boolean) {
		if (value) {
			this._element.classList.remove('disabled');
			this._element.setAttribute('aria-disabled', String(false));
			this._element.tabIndex = 0;
		} else {
			this._element.classList.add('disabled');
			this._element.setAttribute('aria-disabled', String(true));
			removeTabIndexAndUpdateFocus(this._element);
		}
		this.applyStyles(); // {{SQL CARBON EDIT}}
	}

	get enabled() {
		return !this._element.classList.contains('disabled');
	}

	focus(): void {
		this._element.focus();
	}
}

export class ButtonGroup extends Disposable {
	private _buttons: Button[] = [];

	constructor(container: HTMLElement, count: number, options?: IButtonOptions) {
		super();

		this.create(container, count, options);
	}

	get buttons(): Button[] {
		return this._buttons;
	}

	private create(container: HTMLElement, count: number, options?: IButtonOptions): void {
		for (let index = 0; index < count; index++) {
			const button = this._register(new Button(container, options));
			this._buttons.push(button);

			// Implement keyboard access in buttons if there are multiple
			if (count > 1) {
				this._register(addDisposableListener(button.element, EventType.KEY_DOWN, e => {
					const event = new StandardKeyboardEvent(e);
					let eventHandled = true;

					// Next / Previous Button
					let buttonIndexToFocus: number | undefined;
					if (event.equals(KeyCode.LeftArrow)) {
						buttonIndexToFocus = index > 0 ? index - 1 : this._buttons.length - 1;
					} else if (event.equals(KeyCode.RightArrow)) {
						buttonIndexToFocus = index === this._buttons.length - 1 ? 0 : index + 1;
					} else {
						eventHandled = false;
					}

					if (eventHandled && typeof buttonIndexToFocus === 'number') {
						this._buttons[buttonIndexToFocus].focus();
						EventHelper.stop(e, true);
					}

				}));
			}
		}
	}
}
