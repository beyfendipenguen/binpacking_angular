import { ThreeJSTruckVisualizationComponent } from './threejs-truck-visualization.component';

// Bileşen gerçek bir WebGL bağlamı gerektirdiği için (headless Karma'da yok)
// burada örneklenmez; render/sürükleme davranışı elle ve görsel olarak test edilir.
describe('ThreeJSTruckVisualizationComponent', () => {
  it('sınıf tanımlı', () => {
    expect(ThreeJSTruckVisualizationComponent).toBeDefined();
  });
});
