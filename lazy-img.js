/**
`lazy-img`
Lazy loading img element, delays loading images until they come into the viewport

@demo demo/index.html
*/
/*
  FIXME(polymer-modulizer): the above comments were extracted
  from HTML and may be out of place here. Review them and
  then delete this comment!
*/
import '../../@polymer/polymer/polymer-legacy.js';

import '../../poly-poly/poly-poly.js';

const elementObservers = new WeakMap();

function notifyEntries(entries){
  for(let i = 0; i < entries.length; i++) {
    entries[i].target._load();
  }
}

const blankSrc = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const polypoly = /** @type {!PolyPolyElement} */ document.createElement('poly-poly');

Polymer({
  _template: Polymer.html`
    <style>
      :host {
        display: inline-block;
        overflow: hidden;
        position: relative;
      }

      img {
        display: block;
        width: var(--lazy-img-width, auto);
        height: var(--lazy-img-height, auto);
        @apply(--lazy-img);
      }

      img.loaded {
        @apply(--lazy-img-loaded);
      }
    </style>
    <img id="img" alt="[[alt]]">
`,

  is: 'lazy-img',

  properties: {
    /** The source URL for the image */
    src: {
      type: String,
      observer: '_onSrcChanged'
    },

    /** The alt attribute for the image */
    alt: {
      type: String
    },

    /** The root selector for the observer */
    observe: {
      type: String
    },

    /**
      * The offset applied to the root's bounding_box when calculating
      * intersections, effectively shrinking or growing the root for any
      * calculation purposes. Supports pixels ('px') or percentages ('%').
      */
    margin: {
      type: String,
      value: '0px 0px 0px 0px'
    },

    /**
      * The ratio of intersection needed to trigger loading. 0 means any
      * pixel, 50 means 50% (half the image) needs to be within the root
      * target, 100 means the image has to be completely within the view.
      */
    threshold: {
      type: Number,
      value: 0.0
    }
  },

  /** cleanup observers when detached */
  detached: function() {
    this._stopObserving();
  },

  /** setting or changing the image src resets the state */
  _onSrcChanged: function(src) {
    this.$.img.src = blankSrc;
    this._stopObserving();

    // why do we have this delay? well apart from the delay being the
    // whole point of lazy loading images, it also helps if child nodes
    // of a scroller are being repositioned in some way (e.g. by some
    // layour element). Without this, the nodes might be immediately
    // in view of the IntersectionObserver which would trigger loading.
    Polymer.RenderStatus.afterNextRender(this, this._startObserving);
  },

  /** load the image, any loading effects will be provided by the css mixin */
  _load: function() {
    const img = this.$.img;
    img.onload = function() {
      img.classList.add('loaded');
    };
    img.src = this._resolveSrc(this.src);

    this._stopObserving();
  },

  /** stop observing visibility changes to this element */
  _stopObserving: function() {
    if (this._observer) {
      this._observer.unobserve(this);
      if (--this._observer._lazyImgCount <= 0) {
        this._deleteObserver(this._observer);
      }
      this._observer = null;
    }
  },

  /** start observing for this element becoming visible */
  _startObserving: function() {
    this._getObserver().then(function(observer) {
      this._observer = observer;
      this._observer.observe(this);
      this._observer._lazyImgCount++;
    }.bind(this));
  },

  /** resolve src image relative to original document, not this element */
  _resolveSrc: function(testSrc) {
    const baseURI = /** @type {string} */(this.ownerDocument.baseURI);
    return (new URL(Polymer.ResolveUrl.resolveUrl(testSrc, baseURI), baseURI)).href;
  },

  /**
   * get or create the observer for this element
   *
   * returns a promise so that IntersectionObserver
   * can be polyfilled asynchronously and everything
   * be wired up and created before that happens.
   */
  _getObserver: function() {
    return new Promise(function(resolve, reject) {
      polypoly.completes.then(function() {

        const observer;

        // get element based on selector if there is one
        const el = this.observe ? this._getClosest() : null;
        const node = el || document.documentElement;

        const options = {
          root: el,
          rootMargin: this.margin,
          threshold: this.threshold
        }

        // See if there is already an observer created for the
        // intersection options given. Note we perform a double
        // lookup (map within a map) because the actual map key
        // is a different instance and there is no hashing
        const observersMap = elementObservers.get(node);
        if (!observersMap) {
          observersMap = new Map();
          elementObservers.set(node, observersMap);
        }

        const key = options.margin + '/' + options.threshold;
        observer = observersMap.get(key);
        if (!observer) {
          // first time for this observer options combination
          observer = new IntersectionObserver(notifyEntries, options);
          observer._lazyImgKey = key;
          observer._lazyImgCount = 0;
          observersMap.set(key, observer);
        };

        resolve(observer);

      }.bind(this));
    }.bind(this));
  },

  /** disconnect and delete an observer */
  _deleteObserver: function(observer) {
    const observersMap = elementObservers.get(observer.root);
    if (observersMap) {
      observersMap.delete(observer._lazyImgKey);
      if (observersMap.size === 0) {
        elementObservers.delete(observer.root);
      }
    }
    observer.disconnect();
  },

  /** get the closest element with the given selector */
  _getClosest: function() {
    const el = this;
    while (el.matches && !el.matches(this.observe)) el = el.parentNode;
    return el.matches ? el : null;
  }
});
