class Position {

    constructor(sheep, floors) {
        this.sheep = sheep;
        this.floors = document.querySelectorAll(floors);

        this.stepTimeout = null;
        this.lastStepTime = null;
        this.animationTimeout = null;
        this.lastAnimTime = null;
        this.resumeTmt = null;
        this.x = 0;
        this.y = 0;
        this.floor = null;
        this.floorY = 0;
        this.bounding = { left: 0, right: 0 };
        this.onAnimationComplete = null;

        this._stepDelegate = this.step.bind(this);
        this._resizeDelegate = this.onWindowResize.bind(this);
        this._scrollDelegate = this.onScroll.bind(this);

        mixinEvents(this);

        const action = this.sheep.getAction();

        sheep.on("tick", this.onTick, this);
        action.on("run", this.onActionRun, this);
        action.on("stop", this.onActionStop, this);
        action.on("step", this.onActionStep, this);

        window.addEventListener("resize", this._resizeDelegate, false);
        window.addEventListener("scroll", this._scrollDelegate, false);
    }

    setFloor(el) {
        this.floor = el;
        if (el) {
            this.bounding = getClientRect(el);
            this.floorY = this.bounding.floor;
        }
    }

    getFloor() { return this.floor; }

    onTick(tickTime) {
        if (this.stepTimeout && this.lastStepTime &&
            tickTime - this.lastStepTime > this.stepTimeout) {
            this.lastStepTime = tickTime;
            this.step();
        }

        if (this.animationTimeout && this.lastAnimTime &&
            tickTime - this.lastAnimTime > this.animationTimeout) {
            this.lastAnimTime = tickTime;
            this.animationStep(tickTime);
        }
    }

    step() {
        const action = this.sheep.getAction();
        const dir = this.sheep.getDirection();
        let xShift = action.xShift;

        if (dir === "l") {
            xShift *= -1;
        }

        this.x += xShift;
        this.updatePosition();

        if (this.isOnBounding()) {
            this.x = dir === "l" ? this.bounding.left : this.bounding.right - SIZE;
            this.updatePosition();
            this.stop();
            this.trigger("bounding");
        }
    }

    isOnBounding(edge) {
        const dir = edge || this.sheep.getDirection();
        if (dir === "l" && this.x <= this.bounding.left) return true;
        if (dir === "r" && this.x + SIZE >= this.bounding.right) return true;
        return false;
    }

    set(x, y) {
        this.x = x;
        this.y = y;
        this.updatePosition();
    }

    addX(value) { this.x += value; this.updatePosition(); }
    addY(value) { this.y += value; this.updatePosition(); }
    getX() { return this.x; }
    getY() { return this.y; }

    updatePosition() {
        const style = this.sheep.getElem().style;
        style.left = `${this.x}px`;
        style.top = `${this.y}px`;
    }

    onActionRun(action) {
        if (action.moveItv) {
            this.lastStepTime = Date.now();
            this.stepTimeout = action.moveItv;
        }
    }

    onActionStop() {
        this.stop();
    }

    onActionStep(action, frame) {
        if (typeof frame !== "number") {
            if (frame.moveItv) {
                action.xShift = frame.xShift;
                action.yShift = frame.yShift;
                action.moveItv = frame.moveItv;
                this.onActionRun(action);
            }
            if (frame.stopMoving) {
                this.stop();
            }
        }
    }

    stop() {
        this.stepTimeout = null;
        this.lastStepTime = null;
    }

    animateTo(toX, toY, duration, easing, cb, scope) {
        const start = Date.now();
        const startX = this.x;
        const startY = this.y;
        const xLen = toX - startX;
        const yLen = toY - startY;

        let xEasing, yEasing;
        if (!easing) {
            xEasing = yEasing = easings.linear;
        } else if (Array.isArray(easing)) {
            xEasing = easing[0];
            yEasing = easing[1];
        } else {
            xEasing = yEasing = easing;
        }

        this.lastAnimTime = start;
        this.animationTimeout = 40;

        this.animationStep = (tickTime) => {
            let time = tickTime - start;
            if (time > duration) time = duration;

            this.x = startX + xEasing(time, 0, xLen, duration);
            this.y = startY + yEasing(time, 0, yLen, duration);

            if (this.sheep.getAction().bound) {
                this.x = Math.max(this.bounding.left, Math.min(this.x, this.bounding.right - SIZE));
            }

            this.updatePosition();

            if (time === duration) {
                if (cb) cb.call(scope || this.sheep);
                if (this.onAnimationComplete) {
                    this.onAnimationComplete();
                    this.onAnimationComplete = null;
                }
                this.stopAnimation();
            }
        };
    }

    stopAnimation() {
        this.animationTimeout = null;
    }

    onWindowResize() { this.adjustToWindow(); }
    onScroll() { this.adjustToWindow(); }

    adjustToWindow() {
        const rect = getClientRect(window);

        if (this.resumeTmt) {
            clearTimeout(this.resumeTmt);
        }

        if (this.y + SIZE > rect.floor) {
            this.setFloor(window);
            this.stopAnimation();
            this.sheep.stop();
            this.sheep.setFrame(23);

            this.floorY = rect.floor;
            this.y = this.floorY - SIZE;
            this.updatePosition();

            this.resumeTmt = setTimeout(() => this.sheep.start(), 2000);
        } else if (this.y + SIZE < rect.floor && this.floor === window) {
            this.setFloor(window);
            this.sheep.stop();
            this.sheep.setFrame(47);
            this.floorY = rect.floor;
            this.animateTo(this.x, this.floorY - SIZE, 1000, easings.easeInQuad);
            this.onAnimationComplete = () => {
                this.sheep.setFrame(85);
                this.resumeTmt = setTimeout(() => this.sheep.start(), 2000);
            };
        } else if (!this.sheep.auto) {
            this.resumeTmt = setTimeout(() => this.sheep.start(), 1000);
        }
    }

    findUpperFloor() {
        return this.findFloor("upper", null);
    }

    findLowerFloor() {
        return this.findFloor("lower", window);
    }

    findFloor(which, def) {
        const found = [];

        for (const f of this.floors) {
            if (f === this.floor || f === window || !isReachable(f)) continue;

            const rect = getClientRect(f);
            if (which === "upper" && rect.floor >= this.floorY) continue;
            if (which === "lower" && rect.floor <= this.floorY) continue;

            found.push(f);
        }

        if (found.length) {
            if (def) found.push(def);
            return found.length > 1 ? found[getRandomInt(0, found.length)] : found[0];
        }
        return def;
    }

    findFloorBeneath() {
        for (const f of this.floors) {
            if (f === this.floor || f === window || !isReachable(f)) continue;

            const rect = getClientRect(f);
            if (rect.floor <= this.y + SIZE) continue;
            if (rect.left < this.x && rect.right > this.x) return f;
        }
        return window;
    }
}
