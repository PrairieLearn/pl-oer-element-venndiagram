var objects = {};
objects.byType = {};
class PLVennCircleAddElement extends PLDrawingBaseElement {
    static generate(apiInstance, canvas, options, submittedAnswer) {
        let r = options && options.radius ? options.radius : 80
        const circle = new fabric.Circle({
            left: options && options.left ? options.left : r + 5,
            top: options && options.top ? options.top : r + 5,
            radius: r,
            strokeWidth: 2,
            stroke: "#000000",
            fill: 'transparent',
            selectable: options && 'selectable' in options ? options.selectable : true,
            hasControls: options && 'hasControls' in options ? options.hasControls : true,
            originX: 'center',
            originY: 'center'
        });

        circle.setControlVisible('bl', false);
        circle.setControlVisible('tl', false);
        circle.setControlVisible('br', false);
        circle.setControlVisible('tr', false);
        circle.setControlVisible('mt', false);
        circle.setControlVisible('mb', false);
        circle.setControlVisible('ml', false);
        circle.setControlVisible('mr', false);
        circle.setControlVisible('mtr', false);

        if (apiInstance.addCircle(canvas, circle, submittedAnswer)) {
            circle.set({label: options.label});
            if (submittedAnswer != null) {
                submittedAnswer.registerAnswerObject(options, circle);
            }
        }
        
    }
};