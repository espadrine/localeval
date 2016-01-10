describe('localeval', function () {
  it('should work in a browser', function () {
    if (!localeval) {
      throw new Error('localeval is not defined');
    }
  });
});
