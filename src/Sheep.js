const SIZE = 40;

const frame2position = (frame) => {
    const perLine = 16;
    const inx = frame % 16;
    const row = (frame - inx) / perLine;
    return [inx * SIZE, row * SIZE];
};

const getRandomInt = (min, max) =>
    Math.floor(Math.random() * (max - min)) + min;

let cssInitialized = false;

const initCSS = (imagePath) => {
    const style = document.createElement("style");
    style.appendChild(document.createTextNode(""));
    document.head.appendChild(style);

    const sheet = style.sheet;

    sheet.insertRule(`.sheep-js {
        position: absolute;
        width: 40px;
        height: 40px;
        background-image: url(${imagePath});
        background-repeat: no-repeat;
        z-index: 9999;
    }`, 0);

    sheet.insertRule(`.sheep-js-reversed {
        transform: scaleX(-1);
    }`, 1);
};

const setFrame = (el, inx) => {
    const [x, y] = frame2position(inx);
    el.style.backgroundPosition = `-${x}px -${y}px`;
};

const isVisible = (el) =>
    el.offsetWidth > 0 && el.offsetHeight > 0;

const getScrollTop = () =>
    window.pageYOffset || document.documentElement.scrollTop || 0;

const getClientRect = (el) => {
    let rect;

    if (el === window) {
        const doc = document.documentElement;
        const scrollTop = getScrollTop();
        rect = {
            left: 0,
            right: doc.clientWidth,
            top: scrollTop,
            bottom: doc.clientHeight + scrollTop,
            width: doc.clientWidth,
            isWin: true,
            floor: doc.clientHeight + scrollTop
        };
    } else {
        rect = el.getBoundingClientRect();
        rect.isWin = false;
        rect.floor = rect.top + getScrollTop();
        rect.width = rect.right - rect.left;
    }

    rect.getCenter = function() { return this.width / 2; };
    rect.getCenterX = function() { return this.left + this.width / 2; };

    return rect;
};

const isReachable = (el) => {
    if (el === window) return true;
    if (!isVisible(el)) return false;

    const rect = getClientRect(el);
    const wrect = getClientRect(window);

    return rect.floor >= wrect.top + SIZE &&
           rect.floor <= wrect.floor &&
           rect.left >= wrect.left &&
           rect.right <= wrect.right;
};

// Simple event emitter mixin
const mixinEvents = (obj) => {
    obj._listeners = {};
    obj.on = function(event, fn, ctx) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push({ fn, ctx });
    };
    obj.un = function(event, fn) {
        const list = this._listeners[event];
        if (!list) return;
        this._listeners[event] = list.filter(l => l.fn !== fn);
    };
    obj.trigger = function(event, ...args) {
        const list = this._listeners[event];
        if (!list) return;
        for (const listener of list) {
            listener.fn.apply(listener.ctx || this, args);
        }
    };
};


class Sheep {

    constructor(options) {
        if (!cssInitialized) {
            initCSS(options.imagePath || 'rsc/sheep.png');
            cssInitialized = true;
        }

        mixinEvents(this);

        this.elem = null;
        this.direction = "l";
        this.position = null;
        this.action = null;
        this.actionId = null;
        this.auto = false;
        this.ofsX = null;
        this.ofsY = null;
        this.dragging = false;

        this._tickDelegate = this.tick.bind(this);
        this._mouseDownDelegate = this.onMouseDown.bind(this);
        this._mouseUpDelegate = this.onMouseUp.bind(this);
        this._mouseMoveDelegate = this.onMouseMove.bind(this);

        this.action = new Action(this);
        this.position = new Position(this, options.floors || "window");

        this.position.on("bounding", this.onBounding, this);
        this.action.on("end", this.onActionEnd, this);

        this.createElem();
        this.trigger("init");
        this.activate();
    }

    getDirection() { return this.direction; }
    getAction() { return this.action; }
    getPosition() { return this.position; }
    getElem() { return this.elem; }

    activate() {
        if (!this.actionId) {
            this.position.setFloor(window);
            this.setAction("meteor");
            requestAnimationFrame(this._tickDelegate);
            this.start();
        }
    }

    start() {
        if (!this.actionId) {
            this.findNewAction();
        }
        this.auto = true;
    }

    stop() {
        this.auto = false;
        this.action.end();
        this.actionId = null;
        this.position.stopAnimation();
    }

    tick() {
        this.trigger("tick", Date.now());
        requestAnimationFrame(this._tickDelegate);
    }

    setAction(id) {
        this.action.stop();
        this.actionId = id;
        this.action.setup(actions[id], id);
        this.action.run();
    }

    changeDirection() {
        if (this.direction === "l") {
            this.elem.className = "sheep-js sheep-js-reversed";
            this.direction = "r";
        } else {
            this.elem.className = "sheep-js";
            this.direction = "l";
        }
    }

    findNewAction() {
        const newInx = getRandomInt(0, actionIds.length);
        const id = actionIds[newInx];
        const action = actions[id];
        const another = () => setTimeout(() => this.findNewAction(), 0);

        if (this.action.nextAction) {
            this.setAction(this.action.nextAction);
            return;
        }

        if (this.actionId === id || action.notAfter === id) return another();
        if (action.isPossible && !action.isPossible(this)) return another();
        if (action.probability && Math.random() > action.probability) return another();
        if (action.notAfter && action.notAfter.includes(this.actionId)) return another();
        if (action.onlyAfter && !action.onlyAfter.includes(this.actionId)) return another();

        this.setAction(id);
    }

    onActionEnd() {
        if (this.auto) this.findNewAction();
    }

    onBounding() {
        if (this.auto) this.findNewAction();
    }

    createElem() {
        const div = document.createElement('div');
        div.className = "sheep-js";
        document.body.appendChild(div);
        this.elem = div;
        div.addEventListener("mousedown", this._mouseDownDelegate, false);
    }

    setFrame(inx) {
        setFrame(this.elem, inx);
    }

    onMouseDown(e) {
        document.documentElement.addEventListener("mousemove", this._mouseMoveDelegate, false);
        document.documentElement.addEventListener("mouseup", this._mouseUpDelegate, false);

        this.stop();
        this.setFrame(50);
        this.getPosition().setFloor(null);
        this.dragging = true;

        const pos = this.getPosition();
        this.ofsX = e.clientX - pos.getX();
        this.ofsY = e.clientY - pos.getY();

        e.preventDefault();
        e.stopPropagation();
        return false;
    }

    onMouseUp() {
        const pos = this.getPosition();
        const floor = pos.findFloorBeneath();
        const rect = getClientRect(floor);

        document.documentElement.removeEventListener("mousemove", this._mouseMoveDelegate);
        document.documentElement.removeEventListener("mouseup", this._mouseUpDelegate);

        this.dragging = false;
        this.setFrame(47);
        pos.animateTo(pos.getX(), rect.floor - SIZE, 1000, easings.easeInCirc, () => {
            if (this.dragging) return;
            this.setFrame(48);
            pos.setFloor(floor);
            setTimeout(() => {
                if (this.dragging) return;
                this.start();
            }, 2000);
        });
    }

    onMouseMove(e) {
        const pos = this.getPosition();
        pos.set(e.clientX - this.ofsX, e.clientY - this.ofsY);
    }
}


window.Sheep = Sheep;
