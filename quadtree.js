import * as THREE from "three";

export class QuadTree {
    constructor(params) {
        // These are the bounds of the entire tree
        const rootBounds = new THREE.Box2(params.min, params.max);

        this.minNodeSize = params.minNodeSize;
        this.rootNode = {
            bounds: rootBounds,
            children: [],
            centre: rootBounds.getCenter(new THREE.Vector2()),
            size: rootBounds.getSize(new THREE.Vector2())
        };
    }

    // Gets the children of each node for the tree
    getChildren() {
        const children = [];
        this._getChildren(this.rootNode, children);
        return children;
    }

    // Loop through subnodes and collect children
    _getChildren(node, target) {
        // If we're at a leaf node, exit
        if (node.children.length == 0) {
            target.push(node);
            return;
        }

        // Otherwise, if the node has children, recurse
        for (let i = 0; i < node.children.length; i++) {
            this._getChildren(node.children[i], target);
        }
    }

    // Insert an object to the tree
    insertObject(position) {
        this.insert(this.rootNode, new THREE.Vector2(position.x, position.z));
    }

    // Insert a new child node if applicable
    insert(child, position) {
        const distanceToChild = child.centre.distanceTo(position);

        // Checks if position is inside the node and the node is not already at max subdivision
        if (distanceToChild < child.size.x && child.size.x > this.minNodeSize) {
            child.children = this.createChildren(child);

            // If we've made new nodes we need to update the children of the initial node
            for (let i = 0; i < child.children.length; i++) {
                this.insert(child.children[i], position);
            }
        }
    }

    // Split a node into four child nodes
    createChildren(child) {
        const midpoint = child.bounds.getCenter(new THREE.Vector2());

        // Create child nodes
        const bottomLeftNode = new THREE.Box2(child.bounds.min, midpoint);
        const bottomRightNode = new THREE.Box2(
            new THREE.Vector2(midpoint.x, child.bounds.min.y),
            new THREE.Vector2(child.bounds.max.x, midpoint.y)
        )
        const topLeftNode = new THREE.Box2(
            new THREE.Vector2(child.bounds.min.x, midpoint.y),
            new THREE.Vector2(midpoint.x, child.bounds.max.y)
        );
        const topRightNode = new THREE.Box2(midpoint, child.bounds.max);

        // Update children by creating a new node for each child, returns directly
        return [bottomLeftNode, bottomRightNode, topLeftNode, topRightNode].map(
            bounds => {
                return {
                    bounds: bounds,
                    children: [],
                    centre: bounds.getCenter(new THREE.Vector2()),
                    size: bounds.getSize(new THREE.Vector2())
                }
            }
        );
    }
}
