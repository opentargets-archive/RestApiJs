// var tntTreeNode = require("tnt.tree.node");

// Given a flat structure of associations
// convert and return that structure to a tree
// TODO: Should this be moved to the cttvApi package?
var rootId = "cttv_root";
var flat2tree = function (data) {
    var associations = data.data;
    var therapeuticAreas = data.therapeutic_areas;

    // Unfold the associations with more than 1 path
    var unfoldedAssociations = unfoldAssoc(associations);

    // Sort them by min path length
    var sortedAssociations = unfoldedAssociations.sort(sortByPathLength);

    var tree = {
        "__id": rootId,
        "name" : "cttv_disease",
        "disease": {
            "id": rootId,
            "name": "cttv_disease"
        }
    };
    var index = {};
    index[rootId] = tree;

    var tas = getTAs(therapeuticAreas);

    for (var i=0; i<sortedAssociations.length; i++) {
        addNode(sortedAssociations[i], tree, tas, index);
    }
    return tree;
};

function unfoldAssoc (arr) {
    var unfold = [];
    for (var i=0; i<arr.length; i++) {
        var node = arr[i];
        if (node.disease.path.length > 1) {
            for (var j=1; j<node.disease.path.length; j++) {
                var clone = cloneNode(node);
                clone.currPath = node.disease.path[j];
                unfold.push(clone);
            }
            node.currPath = node.disease.path[0];
        } else {
            node.currPath = node.disease.path[0];
        }
        // We are getting the root here for now, so filter out the root (ie, path is empty)
        if (!node.currPath) {
            continue;
        }
        unfold.push(node);
    }
    return unfold;
}


function addNode (node, tree, tas, index) {
    // nodes don't have a name, we put one there
    node.__id = node.disease.id;
    node.__name = node.disease.name;
    node.name = node.disease.name;
    // for (var i=0; i<node.disease.path.length; i++) {
        //var path = node.disease.path[i];
        var path = node.currPath;
        // debugger;
        var parent = findParent(path, index);
        delete(node.currPath);

        // If the parent is cttv_root and the node is not a therapeutic area (path.length > 2) we search for the TA in the set of TAs
        if ((parent.__id === rootId) && (path.length > 2)) {
            var taId = node.target.id + "-" + path[1];
            var ta = tas[taId];
            if (!ta) {
                ta = {};
                ta.__name = ta.disease.name;
                ta.name = ta.disease.name;
                ta.disease = {};
                ta.disease.id = path[1];
                ta.disease.name = path[1];
            }
            ta.__id = path[1];
            ta.__name = ta.disease.name;
            ta.name = ta.disease.name;
            if (!tree.children) {
                tree.children = [];
            }
            tree.children.push(ta);
            parent = ta;
            index[ta.__id] = ta;
        }

        if (!parent.children) {
            parent.children = [];
        }

        // If the parent doesn't have a children with the same ID add it
        if (!isPresent(parent.children, node.__id)) {
            parent.children.push(node);
            index[node.__id] = node;
        }
    // }
}

function getTAs (arr) {
    var tas = {};
    for (var i=0; i<arr.length; i++) {
        var ta = arr[i];
        tas[ta.id] = ta;
    }
    return tas;
}

function isPresent (arr, id) {
    for (var i=0; i<arr.length; i++) {
        if (arr[i].__id === id) {
            return true;
        }
    }
    return false;
}

// function findTAname (id, node) {
//     for (var i=0; i<node.disease.therapeutic_area.codes.length; i++) {
//         if (node.disease.therapeutic_area.codes[i] === id) {
//             return node.disease.therapeutic_area.labels[i];
//         }
//     }
// }

function findParent (path, index) {
    for (var i=path.length-2; i>-1; i--) {
        if (!path[i]) {
            return;
        }
        if (index[path[i]]) {
            return index[path[i]];
        }
    }
}

// function findNode (nodeId, tree) {
//     if (tree.__id == nodeId) {
//         return tree;
//     }
//     for (var i=0; i<tree.children.length; i++) {
//         return findNode (nodeId, tree.children[i]);
//     }
// }

function sortByPathLength (a, b) {
    // var aMinPathLength = getMinPathLength(a);
    // var bMinPathLength = getMinPathLength(b);
    // return aMinPathLength - bMinPathLength;
    return a.currPath.length - b.currPath.length;
}

// function getMinPathLength (e) {
//     var mpl = Infinity;
//     for (var i=0; i<e.disease.path.length; i++) {
//         var path = e.disease.path[i];
//         if (path.length < mpl) {
//             mpl = path.length;
//         }
//     }
//     return mpl;
// }

// Fast clone methods
function cloneNode (n) {
    var c = {
        association_score: n.association_score,
        evidence_count: n.evidence_count,
        id: n.id,
        __id: n.__id,
        __name: n.__name,
        target: {
            id: n.target.id,
            name: n.target.name,
            symbol: n.target.symbol
        },
        disease: {
            id: n.disease.id,
            name: n.disease.name,
        },
        datatypes: cloneDatatypes(n.datatypes)
    };
    if (n.is_direct) {
        c.is_direct = n.is_direct;
    }
    var paths = [];
    for (var i=0; i<n.disease.path.length; i++) {
        paths.push(clonePath(n.disease.path[i]));
    }
    c.disease.path = paths;
    return c;
}

function clonePath (p) {
    var c = [];
    for (var i=0; i<p.length; i++) {
        c.push(p[i]);
    }
    return c;
}

function cloneDatatypes (dts) {
    var cs = [];
    for (var i=0; i<dts.length; i++) {
        cs.push(cloneDatatype(dts[i]));
    }
    return cs;
}

function cloneDatatype (d) {
    var c = {
        association_score: d.association_score,
        datatype: d.datatype,
        evidence_count: d.evidence_count
    };

    // Datasources
    var dsrcs = [];
    for (var i=0; i<d.datasources.length; i++) {
        dsrcs.push(cloneDatasource[d.datasources[i]]);
    }
    c.datasources = dsrcs;
    return c;
}

function cloneDatasource (d) {
    var c = {
        association_score: d.association_score,
        datasource: d.datasource,
        evidence_count: d.evidence_count
    };
    return c;
}

module.exports = exports = {
    flat2tree: flat2tree
};
