// Given a flat structure of associations
// convert and return that structure to a tree
var rootId = "cttv_root";
var childrenProperty = "children";

var flat2tree = function (config, taslist) { // cProp -- children property
    var data;
    if (Array.isArray(config)) {
        data = config;
    } else {
        data = config;
        var cProp = config.childrenProperty;
        if (cProp) {
            childrenProperty = cProp;
        }
    }
    var associations = data.data;
    var therapeuticAreas = data.therapeutic_areas;
    // Unfold the associations with more than 1 path
    var unfoldedAssociations = unfoldAssoc(associations);

    // Sort them by min path length
    var sortedAssociations = unfoldedAssociations.sort(sortByPathLength);

    var tree = {
        "__id": rootId,
        "__key": rootId,
        "name" : "cttv_disease",
        "disease": {
            "id": rootId,
            "efo_info": {
                "label": ""
            }
        }
    };

    var tas = getTAs(therapeuticAreas, taslist);

    for (var i=0; i<sortedAssociations.length; i++) {
        addNode(sortedAssociations[i], tree, tas);
    }
    return tree;
};

function unfoldAssoc (arr) {
    var unfold = [];
    // 1. loop through all associations
    for (var i=0; i<arr.length; i++) {
        var node = arr[i];
        // 2. loop through extra paths
        if (node.disease.efo_info.path.length > 1) {
            for (var j=1; j<node.disease.efo_info.path.length; j++) {
                var clone = cloneNode(node);
                clone.currPath = node.disease.efo_info.path[j];
                unfold.push(clone);
            }
        }
        // 2. loop through all paths and remove 'disease' therapeutic area
        // Note: this is no longer needed with the fixed EFO3 data
        // for (var j=0; j<node.disease.efo_info.path.length; j++) {
        //     // remove 'disease' TA from each path
        //     var p = node.disease.efo_info.path[j];
        //     var idx = Math.max(p.indexOf('EFO_0000408'), p.indexOf('efo_0000408'));
        //     if (idx >= 0) {
        //         p.splice(idx, 1);
        //     }
        //     // if more than one path, move the extras out
        //     if (j > 1) {
        //         var clone = cloneNode(node);
        //         clone.currPath = p;
        //         unfold.push(clone);
        //     }
        // }
        node.currPath = node.disease.efo_info.path[0];

        unfold.push(node);
    }

    return unfold;
}


function addNode (node, tree, tas) {
    // nodes don't have a name, we put one there
    node.__id = node.disease.id;
    node.__name = node.disease.efo_info.label;
    node.name = node.disease.efo_info.label;
    node.label = node.disease.efo_info.label;
    node.__association_score = node.association_score.overall;
    node.__evidence_count = node.evidence_count.total;
    var path = node.currPath;

    var parent = findParent(path, tree, node);
    delete(node.currPath);

    // If the parent is cttv_root and the node is not a therapeutic area (path.length > 2) we search for the TA in the set of TAs
    if ((parent.__id === rootId) && (path.length > 1)) {
        var taId = 'TA-' + path[0];
        var ta = tas[taId];
        if (ta) {    
            ta.__id = path[0];
            ta.__name = ta.disease.efo_info.label;
            ta.name = ta.disease.efo_info.label;
            ta.label = ta.disease.efo_info.label;
            ta.__association_score = ta.association_score.overall;
            ta.__evidence_count = ta.evidence_count.total;

            if (!tree[childrenProperty]) {
                tree[childrenProperty] = [];
            }
            tree[childrenProperty].push(ta);
            parent = ta;
        } else {
            console.error("We do not have TA: " + taId);
        }
    }

    if (!parent[childrenProperty]) {
        parent[childrenProperty] = [];
    }

    // Only push the child if it is not there
    if (!hasTwin(parent[childrenProperty], node)) {
        parent[childrenProperty].push(node);
    }
}

function hasTwin (siblings, himself) {
    for (var i=0; i<siblings.length; i++) {
        if (siblings[i].__id === himself.__id) {
            return true;
        }
    }
    return false;
}

/**
 * Merge list of therapeutic areas from the associations and the full static list of TAs into a map
 * @param {*} arr array of therapeutic areas for these associations
 * @param {*} therapeuticareas the static full list of therapeautic areas as returned by the API
 */
function getTAs (arr, therapeuticareas) {
    arr = arr || [];    // avoid 'undefined'-related errors as per some associations
    var tas = {};
    for (var i=0; i<therapeuticareas.length; i++) {
        var ta = therapeuticareas[i];
        // since this is the static list of therapeutic areas, it has only label and code
        // so we initialize other params as needed
        // NOTE: the 'TA-' is used to avoid possible errors/conflicts caused by tas names
        // e.g. on therapeutic area is called 'Function' (to be precise object.Function works
        // but object.function doesn't as it's a javascript reserved word)
        tas['TA-'+ta.code] = {
            id: ta.code,
            disease: {
                efo_info: {
                    label: ta.label
                },
                id: ta.code,
            },
            association_score: {
                overall: 0,
                datatypes: {}
            },
            target: {
                gene_info: {},
                id: undefined
            },
            evidence_count : {}
        };
    }
    // update and override with association-specific TAs
    for (var i=0; i<arr.length; i++) {
        var ta = arr[i];
        tas['TA-'+ta.disease.id] = ta;
    }
    return tas;
}

function findParent (path, tree, myself) {
    var children = tree[childrenProperty] || [];
    for (var i=0; i<path.length; i++) {
        var found = false;
        FINDINCHILDREN:
        for (var j=0; j<children.length; j++) {
            var child = children[j];
                if ((child.__id === path[i]) && (child.__id !== myself.__id)) {
                    tree = child;
                    children = child[childrenProperty] || [];
                    found = true;
                    break FINDINCHILDREN;
                }
        }
        if (!found) {
            return tree;
        }
    }
    return tree;
}

function sortByPathLength (a, b) {
    return a.currPath.length - b.currPath.length;
}

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
        association_score: cloneAssociationScore(n.association_score),
        evidence_count: cloneEvidenceCount(n.evidence_count)
    };
    if (n.is_direct) {
        c.is_direct = n.is_direct;
    }
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

module.exports = exports = {
    flat2tree: flat2tree
};
