import PropTypes                                from "prop-types";
import raf                                      from 'raf';
import { Component, createElement }             from 'react';
import { getInnerHeight, getInnerWigth }        from '../util/getInnerSizes';
import { getScrollbarWidth, isFunction, isset } from '../util/utilities';
import * as defaultElementRender                from "./defaultElementRender";
import * as defaultElementStyles                from "./defaultElementStyle";

export default class Scrollbar extends Component
{
    static propTypes = {
        thumbSizeMin:                 PropTypes.number,
        scrollDetectionThreshold:     PropTypes.number,
        defaultStyles:                PropTypes.bool,
        permanentScrollbars:          PropTypes.bool,
        permanentScrollbarVertical:   PropTypes.bool,
        permanentScrollbarHorizontal: PropTypes.bool,
        contentSizeTrack:         PropTypes.bool,
        contentSizeTrackInterval: PropTypes.number,

        onUpdate:      PropTypes.func,
        onScroll:      PropTypes.func,
        onScrollStart: PropTypes.func,
        onScrollStop:  PropTypes.func,

        tagName:   PropTypes.string,
        className: PropTypes.string,

        renderWrapper:         PropTypes.func,
        renderContent:         PropTypes.func,
        renderTrackVertical:   PropTypes.func,
        renderTrackHorizontal: PropTypes.func,
        renderThumbVertical:   PropTypes.func,
        renderThumbHorizontal: PropTypes.func,
        children:              PropTypes.node,
    };

    static defaultProps = {
        defaultStyles:                true,
        thumbSizeMin:                 30,
        scrollDetectionThreshold:     100,
        permanentScrollbars:          false,
        permanentScrollbarVertical:   false,
        permanentScrollbarHorizontal: false,
        contentSizeTrack:         false,
        contentSizeTrackInterval: 200,

        tagName:               'div',
        className:             'CustomScrollbar',
        renderWrapper:         defaultElementRender.wrapper,
        renderContent:         defaultElementRender.content,
        renderTrackVertical:   defaultElementRender.trackVertical,
        renderTrackHorizontal: defaultElementRender.trackHorizontal,
        renderThumbVertical:   defaultElementRender.thumbVertical,
        renderThumbHorizontal: defaultElementRender.thumbHorizontal,
    };

    //==============//
    //   bindings   //
    //==============//
    constructor(props, ...rest) {
        super(props, ...rest);

        // event handlers has to be hard binded to current instance
        this.handleScrollEvent = this.handleScrollEvent.bind(this);
        this.handleWindowResizeEvent = this.handleWindowResizeEvent.bind(this);
        this.handleTrackVerticalMousedownEvent = this.handleTrackVerticalMousedownEvent.bind(this);
        this.handleTrackHorizontalMousedownEvent = this.handleTrackHorizontalMousedownEvent.bind(this);
        this.handleThumbVerticalMousedownEvent = this.handleThumbVerticalMousedownEvent.bind(this);
        this.handleThumbHorizontalMousedownEvent = this.handleThumbHorizontalMousedownEvent.bind(this);
        this.handleDragStart = this.handleDragStart.bind(this);
        this.handleDragEnd = this.handleDragEnd.bind(this);
        this.handleDragEvent = this.handleDragEvent.bind(this);
    }

    componentWillUnmount() {
        this.handleDragEnd();
        this.removeListeners();

        raf.cancel(this.requestFrame);

        if (this.scrollDetect.interval) {
            clearInterval(this.scrollDetect.interval);
            this.scrollDetect.interval = undefined;
        }
        this.contentSizeTrackStop();
    }

    componentDidMount() {
        this.addListeners();
        this.update();

        if (this.props.contentSizeTrack) {
            this.contentSizeTrackStart();
        }
    }

    componentDidUpdate() {
        this.update();

        const {scrollHeight = 0, scrollWidth = 0, clientHeight = 0, clientWidth = 0} = this.content;
        this.contentSizeTrackPreviousSize = {scrollHeight, scrollWidth, clientHeight, clientWidth};
    }

    componentWillUpdate(nextProps, nextState) {
        if (nextProps.contentSizeTrack !== this.props.contentSizeTrack) {
            if (nextProps.contentSizeTrack) {
                this.contentSizeTrackStart();
            }
            else {
                this.contentSizeTrackStop();
            }
        }
        else if (nextProps.contentSizeTrack && nextProps.contentSizeTrackInterval !== this.props.contentSizeTrackInterval) {
            this.contentSizeTrackStop();
            this.contentSizeTrackStart();
        }
    }

    /**
     * @return {Scrollbar}
     */
    addListeners() {
        if (!isset(document) || !this.content) { return this; }

        const {wrapper, content, trackVertical, trackHorizontal, thumbVertical, thumbHorizontal} = this;

        window.addEventListener('resize', this.handleWindowResizeEvent, {passive: true});
        content.addEventListener('scroll', this.handleScrollEvent, {passive: true});
        trackVertical.addEventListener('mousedown', this.handleTrackVerticalMousedownEvent);
        trackHorizontal.addEventListener('mousedown', this.handleTrackHorizontalMousedownEvent);
        thumbVertical.addEventListener('mousedown', this.handleThumbVerticalMousedownEvent);
        thumbHorizontal.addEventListener('mousedown', this.handleThumbHorizontalMousedownEvent);

        return this;
    }

    /**
     * @return {Scrollbar}
     */
    removeListeners() {
        if (!isset(document) || !this.content) { return this; }

        const {wrapper, content, trackVertical, trackHorizontal, thumbVertical, thumbHorizontal} = this;

        window.removeEventListener('resize', this.handleWindowResizeEvent);
        content.removeEventListener('scroll', this.handleScrollEvent);
        trackVertical.removeEventListener('mousedown', this.handleTrackVerticalMousedownEvent);
        trackHorizontal.removeEventListener('mousedown', this.handleTrackHorizontalMousedownEvent);
        thumbVertical.removeEventListener('mousedown', this.handleThumbVerticalMousedownEvent);
        thumbHorizontal.removeEventListener('mousedown', this.handleThumbHorizontalMousedownEvent);

        return this;
    }

    //==============//
    //     api      //
    //==============//
    /**
     * Set the vertical scroll to given amount of pixels
     *
     * @param top {number} Pixels amount
     */
    set scrollTop(top) {
        if (!this.content) { return; }

        this.content.scrollTop = top;
    }

    /**
     * Return the vertical scroll position
     *
     * @return {number}
     */
    get scrollTop() {
        if (!this.content) { return 0; }

        return this.content.scrollTop;
    }

    /**
     * Set the horizontal scroll to given amount of pixels
     *
     * @param left {number} Pixels amount
     */
    set scrollLeft(left) {
        if (!this.content) { return; }

        this.content.scrollLeft = left;
    }

    /**
     * Return the horizontal scroll position
     *
     * @return {number}
     */
    get scrollLeft() {
        if (!this.content) { return 0; }

        return this.content.scrollLeft;
    }

    /**
     * @return {number}
     */
    get scrollHeight() {
        if (!this.content) { return 0; }

        return this.content.scrollHeight;
    }

    /**
     * @return {number}
     */
    get scrollWidth() {
        if (!this.content) { return 0; }
        return this.content.scrollWidth;
    }

    /**
     * @return {number}
     */
    get clientHeight() {
        if (!this.content) { return 0; }

        return this.content.clientHeight;
    }

    /**
     * @return {number}
     */
    get clientWidth() {
        if (!this.content) { return 0; }

        return this.content.clientWidth;
    }

    /**
     * Scrol to the top border
     *
     * @return {Scrollbar}
     */
    scrollToTop() {
        if (!this.content) { return this; }
        this.content.scrollTop = 0;

        return this;
    }

    /**
     * Scroll to the bottom border
     *
     * @return {Scrollbar}
     */
    scrollToBottom() {
        if (!this.content) { return this; }
        this.content.scrollTop = this.content.scrollHeight;

        return this;
    }

    /**
     * Scrolls to the left border
     *
     * @return {Scrollbar}
     */
    scrollToLeft() {
        if (!this.content) { return this; }
        this.content.scrollLeft = 0;

        return this;
    }

    /**
     * Scroll to the right border
     *
     * @return {Scrollbar}
     */
    scrollToRight() {
        if (!this.content) { return this; }
        this.content.scrollLeft = this.content.scrollWidth;

        return this;
    }

    //==============//
    //   handlers   //
    //==============//
    handleScrollEvent(e) {
        this.update((values) => {
            if (isFunction(this.props.onScroll)) { this.props.onScroll({...values, event: e}); }
        });

        this.scrollDetect();
    }

    scrollDetect() {
        if (this.scrolling) { return; }

        this.scrolling = true;

        if (isFunction(this.props.onScrollStart)) { this.props.onScrollStart(this.getScrollValues()); }

        this.scrollDetect.interval = setInterval(() => {
            if (this.scrollDetect.lastScrollTop === this.content.scrollTop && this.scrollDetect.lastScrollLeft === this.content.scrollLeft && !this.drag) {
                clearInterval(this.scrollDetect.interval);
                this.scrolling = false;

                if (isFunction(this.props.onScrollStop)) { this.props.onScrollStop(this.getScrollValues()); }
            }

            this.scrollDetect.lastScrollTop = this.content.scrollTop;
            this.scrollDetect.lastScrollLeft = this.content.scrollLeft;
        }, this.props.scrollDetectionThreshold);
    }

    handleWindowResizeEvent() {
        this.update();
    }

    handleTrackVerticalMousedownEvent(e) {
        if (e.which !== 1) {return;}
        e.preventDefault();

        const offset = Math.abs(e.target.getBoundingClientRect().top - e.clientY) - this.thumbVertical.clientHeight / 2;

        this.content.scrollTop = this.computeScrollTopForThumbOffset(offset);
    }

    handleTrackHorizontalMousedownEvent(e) {
        if (e.which !== 1) {return;}
        e.preventDefault();

        const offset = Math.abs(e.target.getBoundingClientRect().left - e.clientX) - this.thumbHorizontal.clientWidth / 2;

        this.content.scrollLeft = this.computeScrollLeftForThumbOffset(offset);
    }

    handleThumbVerticalMousedownEvent(e) {
        if (e.which !== 1) {return;}
        e.preventDefault();
        e.stopImmediatePropagation();

        this.handleDragStart();

        const {target, clientY} = e;
        this.dragPrevPageY = target.clientHeight - (clientY - target.getBoundingClientRect().top);
        this.thumbVertical.classList.add('dragging');
    }

    handleThumbHorizontalMousedownEvent(e) {
        if (e.which !== 1) {return;}
        e.preventDefault();
        e.stopImmediatePropagation();

        this.handleDragStart();

        const {target, clientX} = e;
        this.dragPrevPageX = target.clientWidth - (clientX - target.getBoundingClientRect().left);
        this.thumbHorizontal.classList.add('dragging');
    }

    handleDragStart() {
        this.drag = true;
        this.scrollDetect();

        document.addEventListener('mousemove', this.handleDragEvent);
        document.addEventListener('mouseup', this.handleDragEnd);

        document.body.style.userSelect = 'none';
        document.onselectstart = () => false;
    }

    handleDragEnd() {
        this.drag = false;
        this.dragPrevPageX = this.dragPrevPageY = 0;

        document.removeEventListener('mousemove', this.handleDragEvent);
        document.removeEventListener('mouseup', this.handleDragEnd);

        document.body.style.userSelect = null;
        document.onselectstart = undefined;

        this.thumbHorizontal.classList.remove('dragging');
        this.thumbVertical.classList.remove('dragging');
    }

    handleDragEvent(e) {
        if (this.dragPrevPageX) {
            const offset = -this.trackHorizontal.getBoundingClientRect().left + e.clientX - (this.thumbHorizontal.clientWidth - this.dragPrevPageX);
            this.content.scrollLeft = this.computeScrollLeftForThumbOffset(offset);
        }
        if (this.dragPrevPageY) {
            const offset = -this.trackVertical.getBoundingClientRect().top + e.clientY - (this.thumbVertical.clientHeight - this.dragPrevPageY);
            this.content.scrollTop = this.computeScrollTopForThumbOffset(offset);
        }
    }

    //================//
    //   assistance   //
    //================//
    /**
     * Return values representing current scrolling position
     *
     * @return {{left: number, top: number, scrollLeft: number, scrollTop: number, scrollWidth: number, scrollHeight: number, clientWidth: number, clientHeight: number}}
     */
    getScrollValues() {
        const {scrollLeft = 0, scrollTop = 0, scrollWidth = 0, scrollHeight = 0, clientWidth = 0, clientHeight = 0} = this.content || {};

        this.scrollValues = {
            left: (scrollLeft / (scrollWidth - clientWidth)) || 0,
            top:  (scrollTop / (scrollHeight - clientHeight)) || 0,
            scrollTop,
            scrollLeft,
            scrollHeight,
            scrollWidth,
            clientWidth,
            clientHeight,
        };

        return this.scrollValues;
    }

    /**
     * Request animation frame and call given function inside
     *
     * @param cb {function} Function to call in reqiested frame
     * @return {Scrollbar}
     */
    raf(cb) {
        if (isset(this.requestFrame)) {raf.cancel(this.requestFrame);}

        this.requestFrame = raf(() => {
            this.requestFrame = undefined;
            cb();
        });

        return this;
    }

    /**
     * Request animation frame and actualize the scrollbars
     *
     * @param cb {function|undefined} The function to call after actualisation
     * @return {Scrollbar}
     */
    update(cb = undefined) {
        this.raf(() => this.actualizeScrollbars(cb));

        return this;
    }

    /**
     * Returns vertical thumb height corresponding viewport height to scrollable content height ratio
     *
     * @param trackHeight {number} Height of track where thumb placed
     * @return {number}
     */
    computeThumbVerticalHeight(trackHeight) {
        const {scrollHeight, clientHeight} = this.content;
        const {thumbSizeMin} = this.props;
        const height = Math.ceil(clientHeight / scrollHeight * trackHeight);

        return trackHeight === height ? 0 : Math.max(height, thumbSizeMin);
    }

    /**
     * Returns content's scrollTop value corresponding given thumb offset
     *
     * @param offset {number} Thumb's offset top, in pixels
     * @return {number}
     */
    computeScrollTopForThumbOffset(offset) {
        const {clientHeight, scrollHeight} = this.content;
        const trackVerticalInnerHeight = getInnerHeight(this.trackVertical);
        const thumbVerticalHeight = this.thumbVertical.clientHeight;

        return offset / (trackVerticalInnerHeight - thumbVerticalHeight) * (scrollHeight - clientHeight);
    }

    /**
     * Returns horizontal thumb width corresponding viewport width to scrollable content width ratio
     *
     * @param trackWidth {number} Width of track where thumb placed
     * @return {number}
     */
    computeThumbHorizontalWidth(trackWidth) {
        const {scrollWidth, clientWidth} = this.content;
        const {thumbSizeMin} = this.props;
        const width = Math.ceil(scrollWidth / clientWidth * trackWidth);

        return trackWidth === width ? 0 : Math.max(width, thumbSizeMin);
    }

    /**
     * Returns content's scrollLeft value corresponding given thumb offset
     *
     * @param offset {number} Thumb's offset left, in pixels
     * @return {number}
     */
    computeScrollLeftForThumbOffset(offset) {
        const {clientWidth, scrollWidth} = this.content;
        const trackHorizontalInnerWidth = getInnerWigth(this.trackHorizontal);
        const thumbHorizontalWidth = this.thumbHorizontal.clientWidth;

        return offset / (trackHorizontalInnerWidth - thumbHorizontalWidth) * (scrollWidth - clientWidth);
    }

    /**
     * Actualizes scrollbars visibility and thumbs sizes and positions
     *
     * @param cb {function|undefined} The function to call after actualisation
     * @return {Scrollbar}
     */
    actualizeScrollbars(cb = undefined) {
        const scrollValues = this.getScrollValues();
        const {scrollLeft, scrollTop, clientWidth, scrollWidth, clientHeight, scrollHeight} = scrollValues;

        const trackHorizontalInnerWidth = getInnerWigth(this.trackHorizontal),
              trackVerticalInnerHeight  = getInnerHeight(this.trackVertical);

        const thumbHorizontalWidth = this.computeThumbHorizontalWidth(trackHorizontalInnerWidth),
              thumbVerticalHeight  = this.computeThumbVerticalHeight(trackVerticalInnerHeight);

        const thumbHorizontalOffset = thumbHorizontalWidth ? scrollLeft / (scrollWidth - clientWidth) * (trackHorizontalInnerWidth - thumbHorizontalWidth) : 0,
              thumbVerticalOffset   = thumbVerticalHeight ? scrollTop / (scrollHeight - clientHeight) * (trackVerticalInnerHeight - thumbVerticalHeight) : 0;

        this.trackVertical.style.display = this.props.permanentScrollbars || this.props.permanentScrollbarVertical || thumbVerticalHeight ? null : 'none';
        this.thumbVertical.style.transform = `translateY(${thumbVerticalOffset}px)`;
        this.thumbVertical.style.height = thumbVerticalHeight + 'px';

        this.trackHorizontal.style.display = this.props.permanentScrollbars || this.props.permanentScrollbarHorizontal || thumbHorizontalWidth ? null : 'none';
        this.thumbHorizontal.style.transform = `translateX(${thumbHorizontalOffset}px)`;
        this.thumbHorizontal.style.width = thumbHorizontalWidth + 'px';

        if (isFunction(this.refs.onUpdate)) {
            this.refs.onUpdate(scrollValues);
        }
        if (isFunction(cb)) {
            cb(scrollValues);
        }

        return this;
    }

    /**
     * @return {Scrollbar}
     */
    contentSizeTrackStart() {
        if (!this.content || this.contentSizeTrackInterval) { return this; }

        const {scrollHeight = 0, scrollWidth = 0, clientHeight = 0, clientWidth = 0} = this.content;
        this.contentSizeTrackPreviousSize = {scrollHeight, scrollWidth, clientHeight, clientWidth};
        const {contentSizeTrackInterval} = this.props;

        this.contentSizeTrackInterval = setInterval(() => {
            const {scrollHeight = 0, scrollWidth = 0, clientHeight = 0, clientWidth = 0} = this.content;

            if (this.contentSizeTrackPreviousSize.scrollHeight !== scrollHeight || this.contentSizeTrackPreviousSize.scrollWidth !== scrollWidth ||
                this.contentSizeTrackPreviousSize.clientHeight !== clientHeight || this.contentSizeTrackPreviousSize.clientWidth !== clientWidth) {
                this.update();
            }

            this.contentSizeTrackPreviousSize = {scrollHeight, scrollWidth, clientHeight, clientWidth};
        }, contentSizeTrackInterval);

        return this;
    }

    /**
     * @return {Scrollbar}
     */
    contentSizeTrackStop() {
        if (this.contentSizeTrackInterval) {
            clearInterval(this.contentSizeTrackInterval);
        }

        this.contentSizeTrackInterval = undefined;
        this.contentSizeTrackPreviousSize = undefined;

        return this;
    }

    render() {
        const {
                  style, thumbSizeMin, defaultStyles, scrollDetectionThreshold, permanentScrollbars, permanentScrollbarVertical, permanentScrollbarHorizontal,
                  contentSizeTrack, contentSizeTrackInterval,
                  tagName, children, renderWrapper, renderContent, renderTrackVertical, renderTrackHorizontal, renderThumbVertical, renderThumbHorizontal,
                  onUpdate, onScroll, onScrollStart, onScrollStop,
                  ...props
              } = this.props;

        const browserScrollbarWidth = getScrollbarWidth(),
              holderStyle           = {...style, ...(defaultStyles && defaultElementStyles.holder)},
              wrapperStyle          = {...(defaultStyles && defaultElementStyles.wrapper), position: 'relative', overflow: 'hidden'},
              contentStyle          = {...defaultElementStyles.content, marginRight: -browserScrollbarWidth, marginBottom: -browserScrollbarWidth},
              trackVerticalStyle    = {
                  ...(defaultStyles && defaultElementStyles.trackVertical),
                  ...(!permanentScrollbars && !permanentScrollbarVertical && !browserScrollbarWidth && {display: 'none'}),
              },
              thumbVerticalStyle    = {...(defaultStyles && defaultElementStyles.thumbVertical)},
              trackHorizontalStyle  = {
                  ...(defaultStyles && defaultElementStyles.trackHorizontal),
                  ...(!permanentScrollbars && !permanentScrollbarHorizontal && !browserScrollbarWidth && {display: 'none'}),
              },
              thumbHorizontalStyle  = {...(defaultStyles && defaultElementStyles.thumbHorizontal)};

        return createElement(
                tagName,
                {...props, style: holderStyle, ref: (ref) => {this.holder = ref;}},
                [
                    renderWrapper({
                                      key:      'wrapper',
                                      ref:      (ref) => {this.wrapper = ref;},
                                      style:    wrapperStyle,
                                      children: renderContent({
                                                                  key:   'content',
                                                                  ref:   (ref) => {this.content = ref;},
                                                                  style: contentStyle,
                                                                  children,
                                                              }),
                                  }),
                    renderTrackVertical({
                                            key:      'trackVertical',
                                            ref:      (ref) => {this.trackVertical = ref;},
                                            style:    trackVerticalStyle,
                                            children: renderThumbVertical({
                                                                              key:   'thumbVertical',
                                                                              ref:   (ref) => {this.thumbVertical = ref;},
                                                                              style: thumbVerticalStyle,
                                                                          }),
                                        }),
                    renderTrackHorizontal({
                                              key:      'trackHorizontal',
                                              ref:      (ref) => {this.trackHorizontal = ref;},
                                              style:    trackHorizontalStyle,
                                              children: renderThumbHorizontal({
                                                                                  key:   'thumbHorizontal',
                                                                                  ref:   (ref) => {this.thumbHorizontal = ref;},
                                                                                  style: thumbHorizontalStyle,
                                                                              }),
                                          }),
                ],
        );
    }
}