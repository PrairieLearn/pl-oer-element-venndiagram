class PLDrawingBaseElement {
    static generate(_apiInstance, _canvas, _options, _submittedAnswer) {
        return null;
    }
    static button_press(apiInstance, canvas, options, submittedAnswer) {
        options["radius"] = apiInstance.defaultRadius;
        return this.generate(apiInstance, canvas, options, submittedAnswer);
    }
}
let apis = [];
class PLDrawingVennApi {
    constructor() {
        this.elements = {};
        this.circles = {};
        this.overlap_areas = {};
        this.intersecting_circles = new Set(['']);
        this._circle_id_counter = 0;
        this.elementModule = {};
        this.circleLabels = {};
        this.submittedAnswer = null;
        this.selected_areas = {};
        this.canvas = null;
        this.isLabeling = false;
        this.includeSampleSpace = false;
        this.isShading = false;
        this.disabled_actions = {};
        this.defaultRadius = 80;
        this.waitingForLabel = false;
        this.disableMovement = false;
        this.alerts = {};
    }

    registerElements(extensionName, dictionary) {
        _.extend(this.elements, dictionary);
        Object.keys(dictionary).forEach((elem) => {
            this.elementModule[elem] = extensionName;
        });
    }

    getElement(name) {
        let ret = PLDrawingBaseElement;
        if (name in this.elements) {
            let elem = this.elements[name];
            if ('generate' in elem) {
                ret = elem;
            }
        }
        return ret;
    }

    getCircleByID(id) {
        return circles[id];
    }

    getIDByCircle(circle) {
        for (let id of Object.keys(this.circles)) {
            if (this.circles[id] == circle) {
                return id;
            }
        }
        return -1;
    }

    generateID() {
        return this._circle_id_counter++;
    }

    addCircle(canvas, circle) {
        if (Object.keys(this.circles).length >= 10) {
            alert("A maximum of 10 circles may be inserted into the canvas.");
            return false;
        }
        let new_id = this.generateID();

        const disableMovement = this.disableMovement || false;

        circle.set({
            selectable: !disableMovement,
            hasControls: false,
            id: new_id
        });
        this.circles[new_id] = circle;
        this.intersecting_circles.add(new_id.toString());
        circle.set({ id: new_id });
        canvas.add(circle);
        this.addOverlapAreas(canvas, new_id);
        if (!Object.hasOwn(this.overlap_areas, [
                []
            ])) {
            this.addBackgroundOverlap(canvas);
        }
        this.updateBackgroundOverlap(canvas);
        this.submittedAnswer.updateAllRegions(this.intersecting_circles);
        //Update the objects array too - to keep all_regions and objects updated
        this.submittedAnswer._answerData.objects = this.circles;
        this.updateOverlap(canvas);
        return true;
    }

    checkCurrentAlerts() {
        let placeholder_alert = $("#placeholder-alert");
        if (Object.keys(this.alerts).length > 0) {
            placeholder_alert.addClass("d-none");
        } else {
            placeholder_alert.removeClass("d-none");
        }
    }

    /**
     * Main entrypoint for the drawing element.
     * Creates canvas at a given root element.
     * @param root_elem DIV that holds the canvas.
     * @param existing_answer_submission Existing submission to place on the canvas.
     */

    createAnswer(canvas, submittedAnswer) {
        const name = "pl-venn-circle-add";
        let added = null;
        let obj_ary = submittedAnswer._answerData.objects;
        let shaded_regions = submittedAnswer._answerData.shaded_regions;

        if (name in this.elements) {
            const element = this.elements[name];

            if (submittedAnswer != null && Object.keys(obj_ary).length > 0) {
                for (const key in obj_ary) {
                    element.generate(this, canvas, obj_ary[key], submittedAnswer);
                }

                this.updateOverlap(canvas);
                this.checkNumOverlappingCircles();
                let all_regions = submittedAnswer._answerData.all_regions;
                for (const k in shaded_regions) {
                    if (!all_regions.includes(shaded_regions[k])) {
                        delete shaded_regions[k];
                    }
                }

                for (let k in shaded_regions) {
                    if (this.overlap_areas[shaded_regions[k]]) {
                        this.overlap_areas[shaded_regions[k]].set({ fill: 'blue', opacity: 0.5 });
                    }
                }

                for (let id in this.circles) {
                    this.associateLabel(canvas, this.circles[id], this.circles[id].label);
                    this._circle_id_counter = Math.max(this._circle_id_counter, parseInt(id) + 1);
                }
            }
        } else {
            console.warn('No element type: ' + name);
        }

        return added;
    }

    handleDelete() {
        if (this.disabled_actions["delete"]) {
            return;
        }
        if (this.canvas instanceof fabric.Canvas) {
            let active_objects = this.canvas.getActiveObjects();
            for (let obj of active_objects) {
                if (this.getIDByCircle(obj) != -1) {
                    this.removeCircle(this.canvas, this.getIDByCircle(obj));
                }
            }
            this.updateBackgroundOverlap();
        }
    }

    handleEdit() {
        if (this.disabled_actions["label"]) {
            return;
        }
        if (this.canvas instanceof fabric.Canvas) {
            if (!this.isLabeling) {
                this.toggleLabelingMode(this.canvas, false);
            }
        }
    }

    deleteSelectedCircles(canvas) {
        const activeObjects = canvas.getActiveObjects();

        activeObjects.forEach((obj) => {
            this.removeCircle(canvas, this.getIDByCircle(obj));
        });
        this.updateBackgroundOverlap(canvas);
    }

    getClip(r, x1, y1, x2, y2, clipPath = null) {
        return new fabric.Circle({
            top: -r + y1 - y2,
            left: -r + x1 - x2,
            radius: r,
            clipPath: clipPath
        });
    }

    toggleLabelingMode(canvas, button_click = true) {
        if (this.isLabeling) {
            return;
        }
        this.isLabeling = true;
        let selectedCircles = canvas.getActiveObjects()
        if (selectedCircles.length > 1) {
            this.isLabeling = false;
            return;
        } else if (selectedCircles.length == 0) {
            this.isLabeling = false;
            if (button_click) {
                this.waitingForLabel = true;
                this.addAlert("label_alert", "label-alert");
                // $("#label-alert").removeClass('d-none');
                this.checkCurrentAlerts();
            }
            return;
        }
        this.waitingForLabel = false;
        let selectedCircle = selectedCircles[0];
        let id = this.getIDByCircle(selectedCircle);
        if (!(id in this.circleLabels)) {
            this.associateLabel(canvas, selectedCircle, '');
        }
        this.editLabel(canvas, selectedCircle);
    }


    editLabel(canvas, circle) {
        const circleId = this.getIDByCircle(circle);
        const existingLabel = this.circleLabels[circleId];

        if (!existingLabel) {
            return;
        }

        const editableLabel = new fabric.IText(existingLabel.text, {
            left: existingLabel.left,
            top: existingLabel.top,
            originX: existingLabel.originX,
            originY: existingLabel.originY,
            fontSize: existingLabel.fontSize,
            selectable: true,
            hasControls: false,
        });

        this.circleLabels[circleId] = editableLabel;

        canvas.remove(existingLabel);
        canvas.add(editableLabel);

        editableLabel.enterEditing();
        canvas.setActiveObject(editableLabel);

        editableLabel.selectable = true;
        editableLabel.setSelectionStart(editableLabel.text.length);
        editableLabel.setSelectionEnd(editableLabel.text.length);

        const exitEditingOnEnter = (event) => {
            if (event.key === "Enter") {
                editableLabel.exitEditing();
            }
        };

        window.addEventListener('keydown', exitEditingOnEnter);

        editableLabel.on('editing:exited', () => {
            circle.set({ label: editableLabel.text });
            window.removeEventListener('keydown', exitEditingOnEnter); // Ensure cleanup
            this.setFixedLabel(canvas, circleId, editableLabel);
            this.isLabeling = false;
            this.submittedAnswer.updateObject(circle);
            this.removeAlert("label_alert");
            this.checkCurrentAlerts();
        });
    }

    setFixedLabel(canvas, circleId, editableLabel) {
        const fixedLabel = new fabric.Text(editableLabel.text, {
            left: editableLabel.left,
            top: editableLabel.top,
            originX: editableLabel.originX,
            originY: editableLabel.originY,
            fontSize: editableLabel.fontSize,
            selectable: false,
            hasControls: false,
        });
        this.circleLabels[circleId] = fixedLabel;
        canvas.add(fixedLabel);
        canvas.remove(editableLabel);
        canvas.renderAll();
    }

    getCoordinates(circle, group_object, active_objects) {
        let x = circle.left;
        let y = circle.top;
        if (active_objects != null && active_objects.length > 1 && active_objects.indexOf(circle) != -1) {
            x += group_object.left + group_object.width / 2;
            y += group_object.top + group_object.height / 2;
        }
        return [x, y];
    }

    getDefaultOverlap(circle) {
        return new fabric.Circle({
            left: circle.left,
            top: circle.top,
            radius: circle.radius,
            originX: 'center',
            originY: 'center',
            strokeWidth: 0,
            stroke: "#000000",
            fill: '#aaa',
            opacity: 0,
            selectable: false,
            hasControls: false,
            evented: false
        });
    }

    removeCircle(canvas, id) {
        if (!(id in this.circles)) {
            return;
        }

        const circle = this.circles[id];

        const label = this.circleLabels[id];
        if (label) {
            canvas.remove(label);
            delete this.circleLabels[id];
        }

        canvas.remove(circle);
        delete this.circles[id];
        this.intersecting_circles.delete(id.toString());

        let circle_ids = Object.keys(this.circles).sort((a, b) => a - b);

        if ([id] in this.overlap_areas) {
            let overlap = this.overlap_areas[id];
            canvas.remove(overlap);
            delete this.overlap_areas[[id]];
        }
        for (let i = 0; i < circle_ids.length; i++) {
            let second_circle_id = circle_ids[i];
            if (second_circle_id == id) continue;

            let indices_ordered = [id, second_circle_id].sort((a, b) => a - b);
            this.intersecting_circles.delete(indices_ordered.toString());
            if (indices_ordered in this.overlap_areas) {
                let overlap = this.overlap_areas[indices_ordered];
                canvas.remove(overlap);
                delete this.overlap_areas[indices_ordered];
            }

            for (let j = i + 1; j < circle_ids.length; j++) {
                let third_circle_id = circle_ids[j];
                if (third_circle_id == second_circle_id || third_circle_id == id) continue;

                indices_ordered = [id, second_circle_id, third_circle_id].sort((a, b) => a - b);
                this.intersecting_circles.delete(indices_ordered.toString());
                if (indices_ordered in this.overlap_areas) {
                    let overlap = this.overlap_areas[indices_ordered];
                    canvas.remove(overlap);
                    delete this.overlap_areas[indices_ordered];
                }
            }
        }

        this.updateOverlap(canvas);
        this.submittedAnswer.updateAllRegions(this.intersecting_circles);
        this.submittedAnswer._answerData.objects = this.circles; //||| to add circles.
        this.submittedAnswer._answerData.shaded_regions = this.selected_areas;
    }


    associateLabel(canvas, circle, label_name) {
        const circle_id = this.getIDByCircle(circle);
        if (circle_id in this.circleLabels) {
            return;
        }

        const label = new fabric.Text(label_name, {
            left: circle.left,
            top: circle.top - (circle.radius || 0) - 20,
            originX: 'center',
            originY: 'bottom',
            fontSize: 20,
            selectable: false,
            hasControls: false,
        });

        this.circleLabels[circle_id] = label;
        circle.set({ label: label_name });
        canvas.add(label);
        canvas.renderAll();
    }


    addBackgroundOverlap(canvas) {
        if (!this.includeSampleSpace) {
            return;
        }
        let overlap = new fabric.Rect({
            left: 0,
            top: 0,
            height: canvas.getHeight(),
            width: canvas.getWidth(),
            fill: '#aaa',
            opacity: 0,
            selectable: false,
            hasControls: false,
            hoverCursor: 'default'
        });
        this.overlap_areas[[]] = overlap;
        canvas.add(overlap);
        overlap.sendToBack();
        canvas.renderAll();
    }

    updateBackgroundOverlap(canvas) {
        if (!this.includeSampleSpace) {
            return;
        }
        let all_circles = Object.values(this.circles);
        let group_object = null;
        let active_objects = null;
        if (canvas instanceof fabric.Canvas) {
            group_object = canvas.getActiveObject();
            active_objects = canvas.getActiveObjects();
        }
        let clip_group = all_circles.map(circle => {
            let coordinates = this.getCoordinates(circle, group_object, active_objects);
            return new fabric.Circle({
                left: coordinates[0],
                top: coordinates[1],
                radius: circle.radius,
                originX: 'center',
                originY: 'center',
                selectable: false,
                hasControls: false,
            });
        });
        let clip = new fabric.Group(clip_group, { absolutePositioned: true })
        clip.inverted = true;
        this.overlap_areas[[]].set({ clipPath: clip });
    }

    removeSelectedAreas() {
        let keys = Object.keys(this.selected_areas);
        for (let region of keys) {
            if (!(this.intersecting_circles.has(region))) {
                this.selected_areas[region] = false;
                let region_arr = region.split(',').map((el) => parseInt(el));
                if (region_arr in this.overlap_areas) {
                    this.overlap_areas[region_arr].set({ opacity: 0, fill: '#aaa' });
                }
            }
        }
    }

    addOverlapAreas(canvas, new_id) {
        let circle_ids = Object.keys(this.circles).map(Number).sort((a, b) => a - b);
        let first_circle = this.circles[new_id];

        let new_overlap = this.getDefaultOverlap(first_circle);
        this.overlap_areas[[new_id]] = new_overlap;
        canvas.add(new_overlap);

        for (let i = 0; i < circle_ids.length - 1; i++) {
            let second_circle_id = circle_ids[i];
            let second_circle = this.circles[second_circle_id];
            new_overlap = this.getDefaultOverlap(second_circle);
            this.overlap_areas[[second_circle_id, new_id]] = new_overlap;
            canvas.add(new_overlap);

            for (let j = i + 1; j < circle_ids.length - 1; j++) {
                let third_circle_id = circle_ids[j];
                let third_circle = this.circles[third_circle_id];
                new_overlap = this.getDefaultOverlap(third_circle);
                this.overlap_areas[[second_circle_id, third_circle_id, new_id]] = new_overlap;
                canvas.add(new_overlap);
            }
        }
        for (let id in this.circles) {
            let circle = this.circles[id];
            circle.bringToFront();
        }
    }

    updateLabel(canvas) {
        if (!(canvas instanceof fabric.Canvas)) {
            return;
        }

        let group_object = canvas.getActiveObject();
        let active_objects = canvas.getActiveObjects();
        let circle_ids = Object.keys(this.circles);

        for (let id of circle_ids) {
            let new_coordinates = this.getCoordinates(this.circles[id], group_object, active_objects);
            let label = this.circleLabels[id];
            if (label) {
                label.set({ left: new_coordinates[0], top: new_coordinates[1] - (this.circles[id].radius || 0) - 20 })
            }
        }
        canvas.renderAll();
    }

    addAlert(alert_name, alert_type, alert_text=null) {
        if (!["error-alert", "label-alert", "shade-alert"].includes(alert_type)) {
            return;
        }
        if (alert_name in this.alerts) {
            return;
        }
        let cloned_obj = $("#" + alert_type).clone();
        cloned_obj.removeClass("d-none");
        if (alert_text !== null) {
            cloned_obj.find("p").text(alert_text);
        }
        $("#alerts-parent").append(cloned_obj);
        this.alerts[alert_name] = cloned_obj;
    }

    removeAlert(alert_name) {
        if (alert_name in this.alerts) {
            this.alerts[alert_name].remove();
            delete this.alerts[alert_name];
        }
    }

    checkNumOverlappingCircles() {
        if (this.circles.length <= 3) {
            return;
        }
        let circle_ids = Object.keys(this.circles);
        let invalid_circle_ids = new Set();

        for (let i = 0; i < circle_ids.length; i++) {
            let c1 = this.circles[circle_ids[i]];
            for (let j = i + 1; j < circle_ids.length; j++) {
                let c2 = this.circles[circle_ids[j]];
                if (!this.isIntersecting(c1, c2)) {
                    continue;
                }
                for (let k = j + 1; k < circle_ids.length; k++) {
                    let c3 = this.circles[circle_ids[k]];
                    if (!this.isIntersecting(c1, c3) || !this.isIntersecting(c2, c3)) {
                        continue;
                    }
                    for (let l = k + 1; l < circle_ids.length; l++) {
                        let c4 = this.circles[circle_ids[l]];
                        if (this.isIntersecting(c1, c4) && this.isIntersecting(c2, c4) && this.isIntersecting(c3, c4)) {
                            invalid_circle_ids.add(circle_ids[i]);
                            invalid_circle_ids.add(circle_ids[j]);
                            invalid_circle_ids.add(circle_ids[k]);
                            invalid_circle_ids.add(circle_ids[l]);
                        }
                    }
                }
            }
        }
        
        if (invalid_circle_ids.size > 0) {
            this.addAlert("intersecting_circles", "error-alert", "Intersecting regions cannot be formed by more than 3 circles.");
        } else {
            this.removeAlert("intersecting_circles");
        }
        this.checkCurrentAlerts();

        if (this.canvas instanceof fabric.Canvas) {
            let group_object = this.canvas.getActiveObject();
            let active_objects = this.canvas.getActiveObjects();
            if (active_objects.length > 1) {
                group_object.getObjects().forEach((c) => {
                    if (invalid_circle_ids.has(c.id.toString())) {
                        c.set({ 'stroke': 'red', 'dirty': true });
                    } else {
                        c.set({ 'stroke': 'black', 'dirty': true });
                    }
                });
            }
        }

        for (let i = 0; i < circle_ids.length; i++) {
            let circle = this.circles[circle_ids[i]]
            if (invalid_circle_ids.has(circle_ids[i].toString())) {
                circle.set({ 'stroke': 'red' });
            } else {
                circle.set({ 'stroke': 'black' });
            }
        }

    }

    isIntersecting(circle1, circle2) {
        let group_object = null;
        let active_objects = null;
        if (this.canvas instanceof fabric.Canvas) {
            group_object = this.canvas.getActiveObject();
            active_objects = this.canvas.getActiveObjects();
        }
        let c1Coords = [circle1.left, circle1.top];
        let c2Coords = [circle2.left, circle2.top];

        if (active_objects != null && active_objects.length > 1) {
            c1Coords = this.getCoordinates(circle1, group_object, active_objects);
            c2Coords = this.getCoordinates(circle2, group_object, active_objects);
        }

        const dist = Math.sqrt(Math.pow(c2Coords[0] - c1Coords[0], 2) + Math.pow(c2Coords[1] - c1Coords[1], 2));
        return dist < (circle1.radius + circle2.radius);
    }


    updateOverlap(canvas) {

        this.updateBackgroundOverlap(canvas);
        let intersections = {}
        let circle_ids = Object.keys(this.circles).sort((a, b) => a - b);

        let group_object = null;
        let active_objects = null;
        if (canvas instanceof fabric.Canvas) {
            group_object = canvas.getActiveObject();
            active_objects = canvas.getActiveObjects();
        }

        for (let i = 0; i < circle_ids.length; i++) {
            for (let j = i + 1; j < circle_ids.length; j++) {
                let first_circle = this.circles[circle_ids[i]];
                let second_circle = this.circles[circle_ids[j]];

                let coordinates = this.getCoordinates(first_circle, group_object, active_objects);
                let x1 = coordinates[0];
                let y1 = coordinates[1];
                const r1 = first_circle.radius;

                coordinates = this.getCoordinates(second_circle, group_object, active_objects);
                let x2 = coordinates[0];
                let y2 = coordinates[1];
                const r2 = second_circle.radius;

                const dist = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

                if (dist < r1 + r2) {
                    this.intersecting_circles.add([circle_ids[i], circle_ids[j]].toString());
                    if (!Object.hasOwn(intersections, circle_ids[i])) {
                        intersections[circle_ids[i]] = [];
                    }
                    if (!Object.hasOwn(intersections, circle_ids[j])) {
                        intersections[circle_ids[j]] = [];
                    }

                    intersections[circle_ids[i]].push(circle_ids[j]);
                    intersections[circle_ids[j]].push(circle_ids[i]);
                } else {
                    this.intersecting_circles.delete([circle_ids[i], circle_ids[j]].toString());
                }

                for (let k = j + 1; k < circle_ids.length; k++) {
                    let third_circle = this.circles[circle_ids[k]];
                    coordinates = this.getCoordinates(third_circle, group_object, active_objects);
                    let x3 = coordinates[0];
                    let y3 = coordinates[1];
                    const r3 = third_circle.radius;

                    const dist2 = Math.sqrt(Math.pow(x3 - x2, 2) + Math.pow(y3 - y2, 2))
                    const dist3 = Math.sqrt(Math.pow(x3 - x1, 2) + Math.pow(y3 - y1, 2))
                    if (dist < r1 + r2 && dist2 < r2 + r3 && dist3 < r3 + r1) {
                        this.intersecting_circles.add([circle_ids[i], circle_ids[j], circle_ids[k]].toString());
                        let clip1 = this.getClip(r1, x1, y1, x2, y2);

                        const all_intersection = new fabric.Circle({
                            top: -r2 + y2 - y3,
                            left: -r2 + x2 - x3,
                            radius: r2,
                            clipPath: clip1
                        });
                        this.overlap_areas[[circle_ids[i], circle_ids[j], circle_ids[k]]].set({ visible: true, clipPath: all_intersection, left: x3, top: y3 });
                    } else {
                        this.intersecting_circles.delete([circle_ids[i], circle_ids[j], circle_ids[k]].toString());
                        this.overlap_areas[[circle_ids[i], circle_ids[j], circle_ids[k]]].set({ visible: false });
                    }
                }
            }
        }

        for (let i = 0; i < circle_ids.length; i++) {
            const first_circle = this.circles[circle_ids[i]];
            let coordinates = this.getCoordinates(first_circle, group_object, active_objects);
            const r1 = first_circle.radius;
            const x1 = coordinates[0];
            const y1 = coordinates[1];

            if (Object.hasOwn(intersections, circle_ids[i])) {
                let all_clips = [];

                for (let j = 0; j < intersections[circle_ids[i]].length; j++) {
                    let idx2 = intersections[circle_ids[i]][j];

                    const second_circle = this.circles[idx2];
                    coordinates = this.getCoordinates(second_circle, group_object, active_objects);
                    const r2 = second_circle.radius;
                    let x2 = coordinates[0];
                    let y2 = coordinates[1];

                    all_clips.push(this.getClip(r2, x2, y2, x1, y1));

                    let intersection_clips = [];
                    if (Number(idx2) > Number(circle_ids[i])) {
                        for (let k = 0; k < intersections[circle_ids[i]].length; k++) {
                            let idx3 = intersections[circle_ids[i]][k];
                            const third_circle = this.circles[idx3];
                            coordinates = this.getCoordinates(third_circle, group_object, active_objects);
                            const r3 = third_circle.radius;
                            const x3 = coordinates[0];
                            const y3 = coordinates[1];

                            if (idx3 != idx2) {
                                intersection_clips.push(this.getClip(r3, x3, y3, x1, y1))
                            }
                        }
                        let intersection_clips_group = new fabric.Group(intersection_clips);
                        intersection_clips_group.inverted = true;
                        let remaining_intersection = this.getClip(r1, x1, y1, x2, y2, intersection_clips_group);
                        this.overlap_areas[[circle_ids[i], idx2]].set({ visible: true, clipPath: remaining_intersection, left: x2, top: y2 });
                    }
                }
                let all_clips_group = new fabric.Group(all_clips);
                all_clips_group.inverted = true;
                this.overlap_areas[[circle_ids[i]]].set({ visible: true, clipPath: all_clips_group, left: x1, top: y1 });
            } else {
                this.overlap_areas[[circle_ids[i]]].set({ visible: true, left: x1, top: y1, clipPath: null });
            }
        }
        this.removeSelectedAreas();
        this.submittedAnswer.updateAllRegions(this.intersecting_circles);
        this.checkNumOverlappingCircles();
        canvas.requestRenderAll();
    }
}

function setupCanvas(apiInstance, root_elem, elem_options, existing_answer_submission) {
    apiInstance.registerElements('_base', { 'pl-venn-circle-add': PLVennCircleAddElement });
    apis.push(apiInstance);
    let canvas_elem = $(root_elem).find('canvas')[0];
    let html_input = $(root_elem).find('input');
    let id = $(root_elem).find('canvas')[0].id;
    cloned_opts = "";
    fabric.Object.prototype.transparentCorners = false;

    let canvas_width = parseFloat(elem_options.width);
    let canvas_height = parseFloat(elem_options.height);
    if ($(window).width() < 768) {
        if (root_elem.offsetWidth == 0) {
            canvas_width = Math.min(canvas_width, $(window).width() * .85);
        } else {
            canvas_width = Math.min(canvas_width, root_elem.offsetWidth);
        }
    } else {
        if (root_elem.offsetWidth == 0) {
            canvas_width = Math.min(canvas_width, $(window).width() - 100);
        } else {
            canvas_width = Math.min(canvas_width, root_elem.offsetWidth - 100);
        }


    }
    canvas_height = canvas_height;

    let disableMovement = elem_options.disable_movement || false;
    apiInstance.disableMovement = disableMovement;

    let includeSampleSpace = elem_options.include_sample_space;
    apiInstance.includeSampleSpace = includeSampleSpace;

    canvas_elem.width = canvas_width;
    canvas_elem.height = canvas_height;

    apiInstance.disabled_actions = elem_options["disabled_actions"];
    apiInstance.defaultRadius = elem_options["default_radius"];

    let canvas;
    if (elem_options.editable) {
        canvas = new fabric.Canvas(canvas_elem);
    } else {
        canvas = new fabric.StaticCanvas(canvas_elem);
    }
    apiInstance.canvas = canvas;

    let drawing_btns = $(root_elem).find('button');
    drawing_btns.each(function(i, btn) {
        const buttonName = $(btn).attr("name");

        if (buttonName === "insert") {
            const elem = apiInstance.getElement("pl-venn-circle-add");
            if (elem !== null) {
                $(btn).click(() => elem.button_press(apiInstance, canvas, {}, submittedAnswer))
            }
        } else if (buttonName === "delete") {
            $(btn).click(() => apiInstance.deleteSelectedCircles(canvas));
        } else if (buttonName === "label") {
            $(btn).click(() => {
                if (apiInstance.waitingForLabel) {
                    apiInstance.waitingForLabel = false;
                    apiInstance.removeAlert("label_alert");
                } else {
                    apiInstance.toggleLabelingMode(canvas);
                }
                apiInstance.checkCurrentAlerts();
            });
        } else if (buttonName === "shade") {
            $(btn).click(() => {
                if (apiInstance.isShading) {
                    apiInstance.removeAlert("shade_alert");
                } else {
                    apiInstance.addAlert("shade_alert", "shade-alert")
                }
                apiInstance.checkCurrentAlerts();
                apiInstance.isShading = !apiInstance.isShading;
            });
        }
    });

    const submittedAnswer = new PLDrawingAnswerState(html_input);
    apiInstance.submittedAnswer = submittedAnswer;
    if (existing_answer_submission != null) {
        submittedAnswer._set(existing_answer_submission);
        apiInstance.createAnswer(canvas, submittedAnswer);
    }


    let selected_areas = apiInstance.selected_areas;
    if (submittedAnswer._answerData.shaded_regions) {
        for (const k in submittedAnswer._answerData.shaded_regions) {
            selected_areas[submittedAnswer._answerData.shaded_regions[k]] = true;
        }
    }

    canvas.on('object:moving', function(e) {
        let obj = e.target;

        if (obj.currentHeight > canvas_width || obj.currentWidth > canvas_height) {
            return;
        }
        let rect = obj.getBoundingRect(true, true);

        if (rect.top < 0 || rect.left < 0) {
            obj.top = Math.max(obj.top, obj.top - rect.top);
            obj.left = Math.max(obj.left, obj.left - rect.left);
        }
        if (rect.top + rect.height > canvas_height || rect.left + rect.width > canvas_width) {
            obj.top = Math.min(obj.top, canvas_height - rect.height + obj.top - rect.top);
            obj.left = Math.min(obj.left, canvas_width - rect.width + obj.left - rect.left);
        }
        if (elem_options.snap_to_grid) {
            obj.top = Math.round(obj.top / elem_options.grid_size) * elem_options.grid_size;
            obj.left = Math.round(obj.left / elem_options.grid_size) * elem_options.grid_size;
        }
        obj.setCoords();

        if (id == 'drawing_element') {
            if (canvas instanceof fabric.Canvas) {
                let selected_objects = canvas.getActiveObjects();
                let grouped_object = canvas.getActiveObject();
                if (selected_objects.length > 1) {
                    for (let selected_circle of selected_objects) {
                        let circle_copy = fabric.util.object.clone(selected_circle);
                        let coords = apiInstance.getCoordinates(selected_circle, grouped_object, selected_objects);
                        circle_copy.set({ left: coords[0], top: coords[1] });
                        submittedAnswer.updateObject(circle_copy);
                    }
                }
                for (let id of Object.keys(apiInstance.circles)) {
                    if (selected_objects.length == 1 && grouped_object.id == id) {
                        apiInstance.circles[id] = grouped_object;
                    }
                }
            }
            
            apiInstance.updateOverlap(canvas);
            apiInstance.updateLabel(canvas);
            
        }
    });

    let prev_section = [-1];

    canvas.on('mouse:move', function(e) {
        const pointer = canvas.getPointer(e.e);
        let threshold = 20;
        if (pointer.x < threshold || pointer.x > canvas.getWidth() - threshold || pointer.y < threshold || pointer.y > canvas.getHeight() - threshold) {
            if (prev_section in apiInstance.overlap_areas) {
                if (!(prev_section.toString() in selected_areas) || !(selected_areas[prev_section.toString()])) {
                    apiInstance.overlap_areas[prev_section].set({ opacity: 0, fill: '#aaa' });
                } else {
                    apiInstance.overlap_areas[prev_section].set({ opacity: 0.5 });
                }
            }
            canvas.renderAll();
            prev_section = [-1];
        } else if ((e.e.shiftKey || apiInstance.isShading) && !apiInstance.disabled_actions["shade"]) {
            canvas.discardActiveObject();
            if (id == 'drawing_element') {
                canvas.setCursor('crosshair');
                let hovered_objects = [];

                const pointer = canvas.getPointer(e.e);
                let circles = apiInstance.circles;
                let circle_ids = Object.keys(circles);
                let overlap_areas = apiInstance.overlap_areas;

                for (let i = 0; i < circle_ids.length; i++) {
                    let circle = circles[circle_ids[i]]
                    if (Math.pow(pointer.x - circle.left, 2) + Math.pow(pointer.y - circle.top, 2) < Math.pow(circle.radius, 2)) {
                        hovered_objects.push(circle_ids[i]);
                    }
                }

                if (JSON.stringify(hovered_objects) == JSON.stringify(prev_section)) {
                    return;
                }
                if (Object.hasOwn(overlap_areas, prev_section)) {
                    if (!Object.hasOwn(selected_areas, prev_section.toString()) || !selected_areas[prev_section.toString()]) {
                        overlap_areas[prev_section].set({ opacity: 0, fill: '#aaa' });
                    } else {
                        overlap_areas[prev_section].set({ opacity: 0.5 });
                    }
                }
                prev_section = hovered_objects;

                if (hovered_objects.length <= 3) {
                    overlap_areas[hovered_objects].set({ opacity: 1 });
                }
                canvas.renderAll();
            }
        } else {
            if (prev_section in apiInstance.overlap_areas) {
                if (!(prev_section.toString() in selected_areas) || !(selected_areas[prev_section.toString()])) {
                    apiInstance.overlap_areas[prev_section].set({ opacity: 0, fill: '#aaa' });
                } else {
                    apiInstance.overlap_areas[prev_section].set({ opacity: 0.5 });
                }
            }
            prev_section = [-1];
            canvas.renderAll();
        }
    });

    canvas.on('mouse:down', (e) => {
        if ((e.e.shiftKey || apiInstance.isShading) && !apiInstance.disabled_actions["shade"]) {
            if (id == 'drawing_element') {
                const pointer = canvas.getPointer(e.e);
                let circles = apiInstance.circles;
                let circle_ids = Object.keys(circles);
                let clicked_objects = [];
                for (let i = 0; i < circle_ids.length; i++) {
                    let circle = circles[circle_ids[i]];
                    if (Math.pow(pointer.x - circle.left, 2) + Math.pow(pointer.y - circle.top, 2) < Math.pow(circle.radius, 2)) {
                        clicked_objects.push(circle_ids[i]);
                    }
                }

                if (clicked_objects.length <= 3) {
                    clicked_obj_str = clicked_objects.toString();
                    if (Object.hasOwn(selected_areas, clicked_objects)) {
                        selected_areas[clicked_obj_str] = !selected_areas[clicked_obj_str];
                    } else {
                        selected_areas[clicked_obj_str] = true;
                    }
                    if (selected_areas[clicked_obj_str]) {
                        apiInstance.overlap_areas[clicked_obj_str].set({ fill: 'blue', opacity: 0.5 });
                    } else {
                        apiInstance.overlap_areas[clicked_obj_str].set({ fill: '#aaa', opacity: 0 });
                    }
                    submittedAnswer.updateShadedRegions(selected_areas);
                }
                canvas.renderAll();
            }
        } else if (apiInstance.waitingForLabel) {
            apiInstance.toggleLabelingMode(canvas);
        }
    });


    canvas.on('mouse:dblclick', function(e) {
        if (apiInstance.disabled_actions["insert"]) {
            return;
        }
        const pointer = canvas.getPointer(e.e);
        threshold = 50;
        if (e.target && e.target.type === 'circle') {
            if (Math.abs(pointer.x - e.target.left) > threshold || Math.abs(pointer.y - e.target.top) > threshold) {
                const elem = apiInstance.getElement("pl-venn-circle-add");
                if (elem !== null) {
                    elem.button_press(apiInstance, canvas, { left: pointer.x, top: pointer.y }, submittedAnswer);
                }
            }
        } else {
            const elem = apiInstance.getElement("pl-venn-circle-add");
            if (elem !== null) {
                elem.button_press(apiInstance, canvas, { left: pointer.x, top: pointer.y }, submittedAnswer);
            }
        }
    });

    // Hide controls on group selection
    canvas.on('selection:created', function(event) {
        if (event.e && event.e.shiftKey) {
            canvas.discardActiveObject();
        }
        const activeObject = event.target;
        if (activeObject instanceof fabric.Group) {
            activeObject.setControlsVisibility({
                bl: false,
                tl: false,
                br: false,
                tr: false,
                mt: false,
                mb: false,
                ml: false,
                mr: false,
                mtr: false
            });
        }
    });
}
class PLDrawingAnswerState {
    constructor(html_input) {
        this._answerData = { 'objects': {}, 'shaded_regions': [], 'all_regions': [] };
        this._htmlInput = html_input;
    }

    _set(submission) {
        let obj_ary = submission.objects;
        this._answerData['shaded_regions'] = submission.shaded_regions;
        this._answerData['all_regions'] = submission.all_regions;
        //this._answerData['objects'] = submission.objects;
        if (obj_ary && obj_ary.length > 0) {
            obj_ary.forEach((object, i) => {
                this._answerData['objects'][object.id] = new fabric.Circle(object);
            });
        }
    }

    _updateAnswerInput() {
        // Correctly escape double back-slashes... (\\)
        let temp_obj = {};
        temp_obj['objects'] = _.values(this._answerData['objects']);
        for (let i = 0; i < temp_obj['objects'].length; i++) {
            temp_obj['objects'][i] = temp_obj['objects'][i].toJSON(['label', 'id']);
        }

        temp_obj['shaded_regions'] = this._answerData['shaded_regions'];
        temp_obj['all_regions'] = this._answerData['all_regions'];
        let temp_obj_str = JSON.stringify(temp_obj).replace('\\\\', '\\\\\\\\');
        this._htmlInput.val(temp_obj_str);
    }

    updateShadedRegions(selected_areas) {
        let shaded_regions = [];
        let keys = _.keys(selected_areas);
        for (let key of keys) {
            if (selected_areas[key]) {
                shaded_regions.push(key);
            }
        }
        this._answerData['shaded_regions'] = shaded_regions;
        this._updateAnswerInput();
    }

    updateAllRegions(regions) {
        this._answerData['all_regions'] = Array.from(regions);
        this._updateAnswerInput();
    }


    /**
     * Update an object in the submitted answer state.
     * @param object Object to update.
     */
    updateObject(object) {
        this._answerData['objects'][object.id] = object;
        this._updateAnswerInput();
    }

    /**
     * Find an object by its ID.
     * @param id Numeric id to search by.
     * @returns The object, if found.  Null otherwise.
     */
    getObject(id) {
        return this._answerData['objects'][id] || null;
    }

    /**
     * Remove an object from the submitted answer.
     * @param object The object to delete, or its ID.
     */
    deleteObject(object) {
        delete this._answerData['objects'][object.id];
        this._updateAnswerInput();
    }

    registerAnswerObject(options, object) {
        let submitted_object = object;
        this.updateObject(submitted_object);

        object.on('modified', () => {
            this.updateObject(submitted_object);
        });

        object.on('removed', () => {
            this.deleteObject(object);
        });
    }
}

document.onkeydown = function(e) {
    let key_num = e.key.charCodeAt(0);
    if (e.key == 'Backspace' || e.key == 'Delete') {
        for (let api of apis) {
            api.handleDelete();
        }
    } else if ((key_num >= 65 && key_num <= 90) || (key_num >= 97 && key_num <= 122) || (key_num >= 48 && key_num <= 57)) {
        for (let api of apis) {
            api.handleEdit();
        }
    }
}