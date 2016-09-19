import { reflector } from '../core/reflection/reflection';
import { getInjectableName, OpaqueToken } from '../core/di';
import { ProviderLiteral } from '../core/di/provider_util';
import { resolveDirectiveNameFromSelector } from '../facade/lang';

/**
 * `UpgradeAdapterRef` controls a hybrid AngularJS v1 / Angular v2 application,
 * but we don't have a use for it right now so no point in creating an interface for it...
 */
export type UpgradeAdapterRef = void;

export interface UpgradeAdapterInstance {
  /**
   * Allows Angular v2 Component to be used from AngularJS v1.
   */
  downgradeNg2Component(type: Type): Function;
  /**
   * Bootstrap a hybrid AngularJS v1 / Angular v2 application.
   */
  bootstrap(element: Element, modules?: any[], config?: angular.IAngularBootstrapConfig): UpgradeAdapterRef;
  /**
   * Allows Angular v2 service to be accessible from AngularJS v1.
   */
  downgradeNg2Provider(token: any): Function;
  /**
   * Allows AngularJS v1 service to be accessible from Angular v2.
   */
  upgradeNg1Provider(name: string, options?: { asToken: any; }): void;
}

export interface UpgradeAdapter {
  new (ng2AppModule: Type): UpgradeAdapterInstance;
}

export class NgMetadataUpgradeAdapter {

  /**
   * Store a reference to the instantiated upgradeAdapter
   */
  constructor( public _upgradeAdapter: UpgradeAdapterInstance ) {}

  /**
   * Used to register an Angular 2 component as a directive on an Angular 1 module,
   * where the directive name is automatically created from the selector.
   *
   * E.g. `.directive(...upgradeAdapter.downgradeNg2Component(Ng2Component))
   */
  downgradeNg2Component( component: Type ): [ string, Function ] {
    const annotations = reflector.annotations( component );
    const cmpAnnotation = annotations[ 0 ];
    const directiveName = resolveDirectiveNameFromSelector( cmpAnnotation.selector );
    return [ directiveName, this._upgradeAdapter.downgradeNg2Component( component ) ];
  }

  /**
   * Used to register an Angular 2 component by including it in the directives array
   * of an ng-metadata annotated Angular 1 component.
   *
   * E.g.
   * ```
   * @Component({
   *  selector: 'foo',
   *  directives: [upgradeAdapter.provideNg2Component(Ng2Component)],
   * })
   * ```
   */
  provideNg2Component( component: Type ): Function {
    const [ directiveName, directiveFactory ] = this.downgradeNg2Component( component );
    reflector.registerDowngradedNg2ComponentName( directiveName, directiveFactory );
    return directiveFactory;
  }

  /**
   * Downgrades an Angular 2 Provider so that it can be registered as an Angular 1
   * factory. Either a string or an ng-metadata OpaqueToken can be used for the name.
   *
   * E.g.
   * ```
   * const otherServiceToken = new OpaqueToken('otherService')
   *
   * .factory(...upgradeAdapter.downgradeNg2Provider('ng2Service', { useClass: Ng2Service }))
   * .factory(...upgradeAdapter.downgradeNg2Provider(otherServiceToken, { useClass: Ng2Service }))
   * ```
   */
  downgradeNg2Provider( name: string | OpaqueToken, options: { useClass: Type } ): [ string, Function ] {
    const downgradedProvider = this._upgradeAdapter.downgradeNg2Provider( options.useClass );
    return [ getInjectableName(name), downgradedProvider ];
  }

  /**
   * Returns a ProviderLiteral which can be used to register an Angular 2 Provider
   * by including it in the providers array of an ng-metadata annotated Angular 1
   * component. Either a string or an ng-metadata OpaqueToken can be used for the name.
   *
   * E.g.
   * ```
   * const otherServiceToken = new OpaqueToken('otherService')
   *
   * @Component({
   *  selector: 'foo',
   *  providers: [
   *    upgradeAdapter.provideNg2Provider('ng2Service', { useClass: Ng2Service })
   *    upgradeAdapter.provideNg2Provider(otherServiceToken, { useClass: Ng2Service })
   *  ],
   * })
   * ```
   */
  provideNg2Provider( name: string | OpaqueToken, options: { useClass: Type } ): ProviderLiteral {
    const downgradedProvider = this._upgradeAdapter.downgradeNg2Provider( options.useClass );
    return {
      provide: getInjectableName(name),
      useFactory: downgradedProvider,
      deps: downgradedProvider.$inject,
    };
  }

  /**
   * Used to make an Angular 1 Provider available to Angular 2 Components and Providers.
   * When using the upgraded Provider for DI, either the string name can be used with @Inject, or
   * a given token can be injected by type.
   *
   * E.g.
   * class $state {}
   *
   * upgradeAdapter.upgradeNg1Provider('$state', { asToken: $state })
   * upgradeAdapter.upgradeNg1Provider('$rootScope')
   *
   * @Component({
   *  selector: 'ng2',
   *  template: `<h1>Ng2</h1>`,
   * })
   * class Ng2Component {
   *  constructor(
   *    @Inject('$rootScope') private $rootScope: any, // by name using @Inject
   *    private $state: $state // by type using the user defined token
   *  ) {}
   * }
   *
   */
  upgradeNg1Provider( name: string, options?: { asToken: any; } ): void {
    return this._upgradeAdapter.upgradeNg1Provider( name, options );
  }

}
