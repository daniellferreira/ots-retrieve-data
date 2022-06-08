const { default: axios } = require("axios");

function getBestSearch(userTraceability) {
  const groupByWithProjection = function (xs, key, proj) {
    return xs.reduce(function (rv, x) {
      (rv[x[key]] = rv[x[key]] || []).push(x[proj]);
      return rv;
    }, {});
  };

  return groupByWithProjection(
    userTraceability.map(({ router_address, session_id }) => ({
      router_address,
      session_id,
    })),
    "router_address",
    "session_id"
  );
}

async function getDataFromFogNodesParallel(route) {
  const serverAddresses = Object.keys(route);

  const promises = serverAddresses.map((addr) => {
    return axios.get(`${addr}/get-data`, {
      params: { session_id: route[addr].join(",") },
    });
  });

  const partialResponses = await Promise.allSettled(promises);

  return partialResponses.map((r) => {
    if (r.status == "fulfilled") {
      if (r.value.status == 200) {
        return r.value.data;
      }
      log.error(r.value.data);
      return [];
    }

    if (r.reason.config && r.reason.config.url) {
      log.error(`${r.reason.config.url} - ${r.reason}`);
    } else {
      log.error(r.reason);
    }

    return [];
  });
}

function mergeUserData(partialUserData) {
  let finalUserData = [];
  for (const arr of partialUserData) {
    finalUserData.concat(arr);
  }

  // return sorted array descending by created_at field in register
  return finalUserData.sort(
    (a, b) =>
      new Date(b.created_at).valueOf() - new Date(a.created_at).valueOf()
  );
}

module.exports = {
  retrieveData: async (req, res) => {
    try {
      let { user, connected_from, connected_to } = req.query;

      const otsResponse = await axios.get(
        `${process.env.OTS_BASE_URL}/track-user`,
        {
          params: { user, connected_from, connected_to },
        }
      );

      if (otsResponse.status != 200) {
        return res.status(400).json({
          message: "error getting user traceability from OTS",
          data: otsResponse.data,
        });
      }

      if (!otsResponse.data || otsResponse.data.length == 0) {
        return res.status(404).json({ message: "track not found" });
      }

      const fogRoute = getBestSearch(otsResponse.data);
      const partialData = await getDataFromFogNodesParallel(fogRoute);
      const finalUserData = mergeUserData(partialData);

      return res.status(200).json(finalUserData);
    } catch (error) {
      log.error(error);
      return res.status(500).json(error);
    }
  },
};
