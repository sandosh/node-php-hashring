function HashRing(servers, algorithm) {
	this.weights = {};
	this.points = {};
	this.order = [];
	this.buckets = null;
	this.total_weight = null;
	this.hash_func = this.get_hash;

	this.servers = servers;
	this.set_targets(this.servers);
}

HashRing.prototype.get_hash = function(key) {
	return this.crc32(key);
};


HashRing.prototype.targets = function() {
	keys = Object.keys(this.weights);
	keys.sort();
	return keys;
};

HashRing.prototype.reset_targets = function() {
	var weights = {};
	this.targets().every(function(target){
		weights[target] = 0;
		return true;
	});
};

HashRing.prototype.set_targets = function(targets) {
	this.reset_targets();
	this.modify_targets(targets);
};

HashRing.prototype.modify_targets = function(targets) {
	this.total_weight = null;
	this.buckets = null;
	that = this;
	targets.every(function(target){
		that.weights[target] = 1;
		return true;
	});
	this.redo_circle();
};

HashRing.prototype.get_total_weight = function() {
	if (this.total_weight) {
		return this.total_weight;
	}
	this.total_weight = 1*160;
	return this.total_weight;
};

HashRing.prototype.percent_weight = function(target) {
	if (!this.weights[target]) {
		return 0;
	}

	return 100 * this.weights[target] / this.get_total_weight();
};

HashRing.prototype.getNode = function(key) {
	if (!this.buckets) {
		this.compute_buckets();
	}

	key_hash  = this.hash_func(key);
	bucket = this.buckets[key_hash % 1024];
	return bucket;
};
function sortNumber(a,b)
{
return a - b;
}

HashRing.prototype.compute_buckets = function() {
	this.order.sort(sortNumber);
	var step = Math.pow(2, 22);
	this.buckets = [];
	for (var i = 0; i < 1024; i++) {
		this.buckets.push(this.target_of_point(step * i));
	}
};

HashRing.prototype.target_of_point = function(point) {
	lo = 0;
	hi = this.order.length - 1;
	while(true) {
		if (point <= this.order[lo] || point > this.order[hi]) {
			return this.points[this.order[lo]];
		}
		mid = lo + Math.floor((hi-lo) / 2);
		if (mid) {
			below_mid = mid - 1;
		} else {
			below_mid = 0;
		}

		if (point <= this.order[mid] && point > this.order[below_mid]) {
			return this.points[this.order[mid]];
		}

		if (this.order[mid] < point) {
			lo = mid + 1;
		} else {
			hi = mid - 1;
		}
	}
};

HashRing.prototype.redo_circle = function() {
	this.points = {};
	this.order = [];
	that = this;
	this.servers.every(function(server) {
		var points = 1 * 160;
		for (var i = 0; i < points; i++) {
			if (server.indexOf(':') > -1) {
				key = server + '-' + i;
			} else {
				key = server + ':' + 11211 + '-' + i;
			}
			key_hash = that.hash_func(key);
			that.order.push(key_hash);
			that.points[key_hash] = server;
		}
		return true;
	});
};


HashRing.prototype.crc32 = (function() {
    function utf8encode(str) {
        var utf8CharCodes = [];

        for (var i = 0, len = str.length, c; i < len; ++i) {
            c = str.charCodeAt(i);
            if (c < 128) {
                utf8CharCodes.push(c);
            } else if (c < 2048) {
                utf8CharCodes.push((c >> 6) | 192, (c & 63) | 128);
            } else {
                utf8CharCodes.push((c >> 12) | 224, ((c >> 6) & 63) | 128, (c & 63) | 128);
            }
        }
        return utf8CharCodes;
    }

    var cachedCrcTable = null;

    function buildCRCTable() {
        var table = [];
        for (var i = 0, j, crc; i < 256; ++i) {
            crc = i;
            j = 8;
            while (j--) {
                if ((crc & 1) == 1) {
                    crc = (crc >>> 1) ^ 0xEDB88320;
                } else {
                    crc >>>= 1;
                }
            }
            table[i] = crc >>> 0;
        }
        return table;
    }

    function getCrcTable() {
        if (!cachedCrcTable) {
            cachedCrcTable = buildCRCTable();
        }
        return cachedCrcTable;
    }

    return function(str) {
        var utf8CharCodes = utf8encode(str), crc = -1, crcTable = getCrcTable();
        for (var i = 0, len = utf8CharCodes.length, y; i < len; ++i) {
            y = (crc ^ utf8CharCodes[i]) & 0xFF;
            crc = (crc >>> 8) ^ crcTable[y];
        }
        return (crc ^ -1) >>> 0;
    };
})();

module.exports = HashRing;