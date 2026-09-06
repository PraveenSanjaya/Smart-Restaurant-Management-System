function req(name, method, rawUrl, headers, body, preScript, testScript) {
  const item = {
    name: name,
    request: {
      method: method,
      header: headers || [{ key: "Content-Type", value: "application/json" }],
      url: rawUrl
    },
    event: []
  };

  if (body !== undefined && body !== null) {
    item.request.body = {
      mode: "raw",
      raw: typeof body === 'object' ? JSON.stringify(body, null, 2) : body,
      options: { raw: { language: "json" } }
    };
  }

  if (preScript) {
    item.event.push({
      listen: "prerequest",
      script: {
        type: "text/javascript",
        exec: Array.isArray(preScript) ? preScript : preScript.trim().split('\n')
      }
    });
  }

  if (testScript) {
    item.event.push({
      listen: "test",
      script: {
        type: "text/javascript",
        exec: Array.isArray(testScript) ? testScript : testScript.trim().split('\n')
      }
    });
  }

  return item;
}

module.exports = { req };
