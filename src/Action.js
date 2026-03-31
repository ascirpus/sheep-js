const allActionProps = {
    frames: [1],
    frameItv: null,
    xShift: 0,
    yShift: 0,
    moveItv: 0,
    loop: false,
    duration: null,
    bound: false,
    minDuration: 5,
    maxDuration: 40,
    notAfter: null,
    onlyAfter: null,
    nextAction: null,
    probability: null,
    onStep() {},
    onStop() {},
    onEnd() {},
    isPossible(sheep) {},
    beforeStart() {}
};


class Action {

    constructor(sheep) {
        this._sheep = sheep;
        this._sheep.on("tick", this.onTick, this);

        this._id = null;
        this._currentFrame = -1;
        this._startTime = null;
        this._lastTime = null;
        this._timeout = null;

        mixinEvents(this);

        sheep.on("init", () => {
            sheep.getPosition().on("bounding", this.onBounding, this);
        });
    }

    setup(props, id) {
        Object.assign(this, allActionProps, props);
        this._id = id;
    }

    run() {
        this._currentFrame = -1;
        this._startTime = Date.now();
        this._lastTime = this._startTime;

        if (this.frameItv) {
            this._timeout = this.frameItv;
        }

        this.beforeStart();
        this.step(this._startTime);
        this.trigger("run", this);

        if (this.loop && !this.duration) {
            this.duration = getRandomInt(this.minDuration, this.maxDuration) * 1000;
        }
    }

    stop() {
        if (this._timeout) {
            this._timeout = null;
            this.onStop();
            this.trigger("stop", this);
        }
    }

    end() {
        this.stop();
        this.onEnd();
        this.trigger("end", this);
    }

    onTick(tickTime) {
        if (this._timeout && this._lastTime && tickTime - this._lastTime > this._timeout) {
            this._lastTime = tickTime;
            this.step(tickTime);
        }
    }

    step(tickTime) {
        const l = this.frames.length;
        let curr = this._currentFrame;

        if (this.duration && tickTime - this._startTime > this.duration) {
            this.end();
            return;
        }

        curr++;
        if (curr === l) {
            if (this.loop) {
                curr = 0;
            } else {
                this.end();
                return;
            }
        }

        this._currentFrame = curr;
        const frame = this.frames[curr];

        if (typeof frame === "number") {
            this._timeout = this.frameItv;
            this._sheep.setFrame(this.frames[curr]);
        } else {
            if (frame.frameItv) {
                this.frameItv = frame.frameItv;
            }
            this._timeout = frame.duration || this.frameItv;
            this._sheep.setFrame(frame.frame);

            if (frame.action) {
                frame.action.call(this);
            }
        }

        this.onStep(curr, frame);
        this.trigger("step", this, frame);
    }

    onBounding() {
        if (this.bound) {
            this.end();
        }
    }
}
