// var tntTreeNode = require("tnt.tree.node");

// Given a flat structure of associations
// convert and return that structure to a tree
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
            "efo_info": {
                "label": ""
            }
        }
    };
    var index = {};
    index[rootId] = tree;

    var tas = getTAs(therapeuticAreas);

    for (var i=0; i<sortedAssociations.length; i++) {
        addNode(sortedAssociations[i], tree, tas, index);
    }
    console.log("TREE...");
    console.log(tree);
    return tree;
};

function unfoldAssoc (arr) {
    var unfold = [];
    for (var i=0; i<arr.length; i++) {
        var node = arr[i];
        if (node.disease.efo_info.path.length > 1) {
            for (var j=1; j<node.disease.efo_info.path.length; j++) {
                var clone = cloneNode(node);
                clone.currPath = node.disease.efo_info.path[j];
                unfold.push(clone);
            }
            node.currPath = node.disease.efo_info.path[0];
        } else {
            node.currPath = node.disease.efo_info.path[0];
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
    node.__name = node.disease.efo_info.label;
    node.name = node.disease.efo_info.label;
    node.__association_score = node.association_score.overall;
    node.__evidence_count = node.evidence_count.total;
    // for (var i=0; i<node.disease.path.length; i++) {
        //var path = node.disease.path[i];
        var path = node.currPath;
        // debugger;
        var parent = findParent(path, index);
        delete(node.currPath);

        // If the parent is cttv_root and the node is not a therapeutic area (path.length > 2) we search for the TA in the set of TAs
        if ((parent.__id === rootId) && (path.length > 1)) {
            var taId = node.target.id + "-" + path[0];
            var ta = tas[taId];
            if (!ta) { // This shouldn't happen;
                console.error("We do not have TA: " + taId);
                // ta = {};
                // ta.__name = ta.disease.efo_info.label; // BROKEN!
                // ta.name = ta.disease.efo_info.label;
                // ta.disease = {};
                // ta.disease.id = path[1];
                // ta.disease.efo_info.label = path[1];
            }
            ta.__id = path[0];
            ta.__name = ta.disease.efo_info.label;
            ta.name = ta.disease.efo_info.label;
            ta.__association_score = ta.association_score.overall;
            ta.__evidence_count = ta.evidence_count.total;
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
    return index.cttv_root;
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
        __association_score: n.__association_score,
        __evidence_count: n.__evidence_count,
        id: n.id,
        __id: n.__id,
        __name: n.__name,
        target: {
            id: n.target.id,
            name: n.target.gene_info.name,
            symbol: n.target.gene_info.symbol
        },
        disease: cloneDisease(n.disease),
        // disease: {
        //     id: n.disease.id,
        //     name: n.disease.efo_info.label,
        // },
        association_score: cloneAssociationScore(n.association_score),
        evidence_count: cloneEvidenceCount(n.evidence_count)
    };
    if (n.is_direct) {
        c.is_direct = n.is_direct;
    }
    // var paths = [];
    // for (var i=0; i<n.disease.efo_info.path.length; i++) {
    //     paths.push(clonePath(n.disease.efo_info.path[i]));
    // }
    // c.disease.path = paths;
    return c;
}

function cloneDisease (disease) {
    var d = {
        id: disease.id,
        efo_info: cloneEfoInfo(disease.efo_info)
    };

    return d;
}

function cloneEfoInfo (efo) {
    var e = {
        label: efo.label,
        path: clonePath(efo.path),
        therapeutic_area: cloneTherapeuticArea(efo.therapeutic_area)
    };
    return e;
}

function cloneTherapeuticArea (tas) {
    var ta = {
        codes: cloneArr(tas.codes),
        labels: cloneArr(tas.labels)
    };
    return ta;
}

function clonePath (p) {
    var c = [];
    for (var i=0; i<p.length; i++) {
        c.push(p[i]);
    }
    return c;
}

function cloneEvidenceCount (ect) {
    var ec = {
        total: ect.total,
        datatype: cloneObj(ect.datatype),
        datasource: cloneObj(ect.datasource)
    };
    return ec;
}

function cloneAssociationScore (asr) {
    var as = {
        overall: asr.overall,
        datatypes: cloneObj(asr.datatypes),
        datasources: cloneObj(asr.datasources)
    };

    return as;
}

function cloneArr (arr) {
    var a = [];
    for (var i=0; i<arr.length; i++) {
        a.push(arr[i]);
    }
    return a;
}

function cloneObj (obj) {
    var o = {};
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            o[key] = obj[key];
        }
    }
    return o;
}

// function cloneDatasources (dsr) {
//     var ds = {};
//     for (var key in dsr) {
//         if (dsr.hasOwnProperty(key)) {
//             ds[key] = dsr[key];
//         }
//     }
//     return ds;
// }
//
// function cloneDatatypes (dts) {
//     var cs = {};
//     for (var key in dts) {
//         if (dts.hasOwnProperty(key)) {
//             cs[key] = dts[key];
//         }
//     }
//     return cs;
// }

// function cloneDatatype (d) {
//     var c = {
//         association_score: d.association_score,
//         datatype: d.datatype,
//         evidence_count: d.evidence_count
//     };
//
//     // Datasources
//     var dsrcs = [];
//     for (var i=0; i<d.datasources.length; i++) {
//         dsrcs.push(cloneDatasource[d.datasources[i]]);
//     }
//     c.datasources = dsrcs;
//     return c;
// }
//
// function cloneDatasource (d) {
//     var c = {
//         association_score: d.association_score,
//         datasource: d.datasource,
//         evidence_count: d.evidence_count
//     };
//     return c;
// }

module.exports = exports = {
    flat2tree: flat2tree
};
